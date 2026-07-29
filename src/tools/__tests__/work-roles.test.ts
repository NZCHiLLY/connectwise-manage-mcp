/**
 * Work role exposure invariants.
 *
 * Work roles are the labour rate card. Every tier needs to read them (to resolve
 * a workRoleId on a time entry, or to check a billable hourly rate), and no tier
 * has a business need to mutate them. This test locks both halves in:
 *
 * - No create/update/delete work role tool is registered at all, so the rate
 *   card cannot be mutated even through the unfiltered "full" profile.
 * - Every named profile can read the rate card.
 *
 * It also guards the tool-count caps that constrain the profiles, since adding
 * reference tools to a profile is the easiest way to breach them by accident.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  auditOutcome: vi.fn().mockResolvedValue(undefined),
}));

import { applyToolProfile, PROFILE_NAMES } from "../profiles.js";

import { registerActivityTools } from "../activities.js";
import { registerCatalogTools } from "../catalog.js";
import { registerCompanyTools } from "../companies.js";
import { registerConfigurationTools } from "../configurations.js";
import { registerContactTools } from "../contacts.js";
import { registerExpenseTools } from "../expenses.js";
import { registerFinanceTools } from "../finance.js";
import { registerHealthTools } from "../health.js";
import { registerMarketingTools } from "../marketing.js";
import { registerOpportunityTools } from "../opportunities.js";
import { registerProcurementTools } from "../procurement.js";
import { registerProjectTools } from "../projects.js";
import { registerSalesTools } from "../sales.js";
import { registerScheduleTools } from "../schedule.js";
import { registerServiceTools } from "../service.js";
import { registerSystemTools } from "../system.js";
import { registerTicketTools } from "../tickets.js";
import { registerTimeEntryTools } from "../time-entries.js";

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
} as unknown as CwManageClient;

const READ_TOOLS = ["cw_list_work_roles", "cw_get_work_role"] as const;
const WRITE_TOOLS = [
  "cw_create_work_role",
  "cw_update_work_role",
  "cw_delete_work_role",
] as const;

/**
 * Copilot Studio refuses tool sets larger than 70, so the role tiers it serves
 * are capped there. L3 is claude.ai-only and exempt. Domain profiles are capped
 * at 40 by the multi-agent design rules.
 */
const PROFILE_CAPS: Record<string, number> = { l1: 70, l2: 70 };
const DOMAIN_CAP = 40;

function registerAll(server: McpServer): void {
  registerActivityTools(server, mockClient);
  registerCatalogTools(server, mockClient);
  registerCompanyTools(server, mockClient);
  registerConfigurationTools(server, mockClient);
  registerContactTools(server, mockClient);
  registerExpenseTools(server, mockClient);
  registerFinanceTools(server, mockClient);
  registerHealthTools(server, mockClient);
  registerMarketingTools(server, mockClient);
  registerOpportunityTools(server, mockClient);
  registerProcurementTools(server, mockClient);
  registerProjectTools(server, mockClient);
  registerSalesTools(server, mockClient);
  registerScheduleTools(server, mockClient);
  registerServiceTools(server, mockClient);
  registerSystemTools(server, mockClient);
  registerTicketTools(server, mockClient);
  registerTimeEntryTools(server, mockClient);
}

/** Tool names actually exposed after the profile allowlist is applied. */
function toolsFor(profile: string | undefined): Set<string> {
  const server = new McpServer({ name: "cw-work-roles", version: "0.0.0" });
  registerAll(applyToolProfile(server, profile));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Set(Object.keys((server as any)._registeredTools));
}

let exposed: Map<string | undefined, Set<string>>;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  // applyToolProfile logs one line per profile; silence the fan-out.
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  exposed = new Map();
  exposed.set("full", toolsFor("full"));
  for (const profile of PROFILE_NAMES) {
    exposed.set(profile, toolsFor(profile));
  }
});

afterAll(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("work role exposure", () => {
  it("registers both read tools", () => {
    const full = exposed.get("full")!;
    for (const name of READ_TOOLS) {
      expect(full.has(name), `${name} should be registered`).toBe(true);
    }
  });

  it("registers no work role write tool, not even under the full profile", () => {
    const full = exposed.get("full")!;
    const present = WRITE_TOOLS.filter((n) => full.has(n));
    expect(present).toStrictEqual([]);
  });

  it("exposes no work role write tool in any profile", () => {
    const offenders: string[] = [];
    for (const [profile, tools] of exposed) {
      for (const name of WRITE_TOOLS) {
        if (tools.has(name)) offenders.push(`${profile}:${name}`);
      }
    }
    expect(offenders).toStrictEqual([]);
  });

  it("lets every profile read the work role rate card", () => {
    const missing: string[] = [];
    for (const profile of PROFILE_NAMES) {
      const tools = exposed.get(profile)!;
      if (!READ_TOOLS.some((n) => tools.has(n))) missing.push(profile);
    }
    expect(missing).toStrictEqual([]);
  });

  it("surfaces the hourly rate in both read tool descriptions", () => {
    const server = new McpServer({ name: "cw-work-roles", version: "0.0.0" });
    registerFinanceTools(server, mockClient);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, { description: string }>;
    for (const name of READ_TOOLS) {
      expect(tools[name].description.toLowerCase()).toContain("hourlyrate");
    }
  });
});

describe("profile tool count caps", () => {
  it("keeps Copilot Studio role tiers at or under their cap", () => {
    const over: string[] = [];
    for (const [profile, cap] of Object.entries(PROFILE_CAPS)) {
      const size = exposed.get(profile)!.size;
      if (size > cap) over.push(`${profile}=${size} (cap ${cap})`);
    }
    expect(over).toStrictEqual([]);
  });

  it("keeps domain profiles at or under 40 tools", () => {
    const over: string[] = [];
    for (const profile of PROFILE_NAMES) {
      if (profile === "l1" || profile === "l2" || profile === "l3") continue;
      const size = exposed.get(profile)!.size;
      if (size > DOMAIN_CAP) over.push(`${profile}=${size}`);
    }
    expect(over).toStrictEqual([]);
  });

  it("every profile resolves to a non-empty tool set", () => {
    const empty = PROFILE_NAMES.filter((p) => exposed.get(p)!.size === 0);
    expect(empty).toStrictEqual([]);
  });
});
