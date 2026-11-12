/**
 * Tier membership: the read-only pricing tier, and the lookups that let the
 * Opportunities and Sales connectors do their own work.
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

const DOMAIN_CAP = 40;
const ROLE_TIERS = ["l1", "l2", "l3", "pricing"];

const PRICING_TOOLS = [
  "cw_search_catalog_items", "cw_get_catalog_item", "cw_count_catalog_items",
  "cw_list_catalog_pricing", "cw_get_catalog_pricing",
  "cw_list_catalog_categories", "cw_list_catalog_sub_categories",
  "cw_search_products", "cw_get_product",
  "cw_search_agreements", "cw_get_agreement", "cw_get_agreement_additions",
  "cw_get_agreement_addition", "cw_list_agreement_configurations",
  "cw_search_companies", "cw_get_company",
  "cw_search_configurations",
  "cw_search_opportunities", "cw_get_opportunity", "cw_list_opportunity_products",
];

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Registered = Record<string, { inputSchema?: any }>;

function registeredFor(profile: string | undefined): Registered {
  const server = new McpServer({ name: "cw-profiles", version: "0.0.0" });
  registerAll(applyToolProfile(server, profile));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (server as any)._registeredTools as Registered;
}

function schemaKeys(schema: unknown): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = schema as any;
  const shape = s?.shape ?? s?._def?.shape?.() ?? s?._zod?.def?.shape ?? s;
  return shape && typeof shape === "object" ? Object.keys(shape) : [];
}

let full: Registered;
let exposed: Map<string, Set<string>>;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  full = registeredFor("full");
  exposed = new Map();
  for (const profile of PROFILE_NAMES) {
    exposed.set(profile, new Set(Object.keys(registeredFor(profile))));
  }
});

afterAll(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("pricing tier", () => {
  it("every pricing tool is registered", () => {
    const missing = PRICING_TOOLS.filter((n) => !(n in full));
    expect(missing).toStrictEqual([]);
  });

  it("pricing is read-only", () => {
    const writers = PRICING_TOOLS.filter(
      (n) => schemaKeys(full[n]?.inputSchema).includes("user_intent"),
    );
    expect(writers).toStrictEqual([]);
    const nonReads = PRICING_TOOLS.filter((n) => !/^cw_(search|list|get|count)_/.test(n));
    expect(nonReads).toStrictEqual([]);
  });

  it("/mcp/pricing selects the pricing profile", () => {
    expect(PROFILE_NAMES).toContain("pricing");
    const tools = new Set(Object.keys(registeredFor("pricing")));
    expect([...tools].sort()).toStrictEqual([...PRICING_TOOLS, "cw_list_work_roles"].sort());
  });
});

describe("domain profiles", () => {
  it("domain profiles stay within 40", () => {
    const over: string[] = [];
    for (const profile of PROFILE_NAMES) {
      if (ROLE_TIERS.includes(profile)) continue;
      const size = exposed.get(profile)!.size;
      if (size > DOMAIN_CAP) over.push(`${profile}=${size}`);
    }
    expect(over).toStrictEqual([]);
  });

  it("opportunities can resolve its own ids", () => {
    const tools = exposed.get("opportunities")!;
    for (const n of ["cw_search_companies", "cw_search_contacts", "cw_search_members"]) {
      expect(tools.has(n), n).toBe(true);
    }
  });

  it("opportunities no longer carries activity type and status admin writes", () => {
    const tools = exposed.get("opportunities")!;
    for (const n of [
      "cw_create_activity_type", "cw_update_activity_type",
      "cw_create_activity_status", "cw_update_activity_status",
    ]) {
      expect(tools.has(n), n).toBe(false);
    }
  });

  it("sales can read opportunities", () => {
    const tools = exposed.get("sales")!;
    expect(tools.has("cw_search_opportunities")).toBe(true);
    expect(tools.has("cw_get_opportunity")).toBe(true);
  });
});

describe("role tier additions", () => {
  it("l2 can read products", () => {
    const tools = exposed.get("l2")!;
    expect(tools.has("cw_search_products")).toBe(true);
    expect(tools.has("cw_get_product")).toBe(true);
  });

  it("l3 can read configurations", () => {
    const tools = exposed.get("l3")!;
    for (const n of ["cw_search_configurations", "cw_get_configuration", "cw_list_agreement_configurations"]) {
      expect(tools.has(n), n).toBe(true);
    }
  });
});
