/**
 * L1 time-entry edit surface.
 *
 * An L1 helpdesk engineer logs time against the tickets they work, so they need
 * to correct it too: fix a duration, move an entry to the right ticket, delete
 * one logged in error. Editing also needs the field lookups — changing workType
 * or chargeCode is impossible without resolving names to IDs first.
 *
 * This pins that surface against a real McpServer with the l1 profile applied,
 * and asserts every mutating entry stays SENTINEL-gated so widening the profile
 * can't quietly hand L1 an ungated write.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  auditOutcome: vi.fn().mockResolvedValue(undefined),
}));

import { applyToolProfile } from "../profiles.js";

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

/** Editing an entry end to end: find it, read it, change it, remove it. */
const EDIT_TOOLS = [
  "cw_search_time_entries",
  "cw_get_time_entry",
  "cw_create_time_entry",
  "cw_update_time_entry",
  "cw_replace_time_entry",
  "cw_copy_time_entry",
  "cw_delete_time_entry",
] as const;

/** Field lookups an edit needs to resolve names to IDs. */
const LOOKUP_TOOLS = [
  "cw_list_work_types",
  "cw_list_charge_codes",
  "cw_list_work_roles",
] as const;

interface ToolEntry {
  description: string;
  inputSchema: {
    shape?: Record<string, unknown>;
    _def?: { shape(): Record<string, unknown> };
  };
}

function shapeKeys(entry: ToolEntry): string[] {
  const s = entry.inputSchema;
  const shape = typeof s?._def?.shape === "function" ? s._def.shape() : s?.shape;
  return Object.keys(shape ?? {});
}

let l1: Record<string, ToolEntry>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const server = new McpServer({ name: "cw-l1-time", version: "0.0.0" });
  const profiled = applyToolProfile(server, "l1");
  registerActivityTools(profiled, mockClient);
  registerCatalogTools(profiled, mockClient);
  registerCompanyTools(profiled, mockClient);
  registerConfigurationTools(profiled, mockClient);
  registerContactTools(profiled, mockClient);
  registerExpenseTools(profiled, mockClient);
  registerFinanceTools(profiled, mockClient);
  registerHealthTools(profiled, mockClient);
  registerMarketingTools(profiled, mockClient);
  registerOpportunityTools(profiled, mockClient);
  registerProcurementTools(profiled, mockClient);
  registerProjectTools(profiled, mockClient);
  registerSalesTools(profiled, mockClient);
  registerScheduleTools(profiled, mockClient);
  registerServiceTools(profiled, mockClient);
  registerSystemTools(profiled, mockClient);
  registerTicketTools(profiled, mockClient);
  registerTimeEntryTools(profiled, mockClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  l1 = (server as any)._registeredTools as Record<string, ToolEntry>;
});

afterAll(() => {
  logSpy.mockRestore();
});

describe("l1 time-entry editing", () => {
  it("exposes the full edit surface", () => {
    const missing = EDIT_TOOLS.filter((n) => !(n in l1));
    expect(missing).toStrictEqual([]);
  });

  it("exposes the field lookups an edit depends on", () => {
    const missing = LOOKUP_TOOLS.filter((n) => !(n in l1));
    expect(missing).toStrictEqual([]);
  });

  it("keeps every mutating time-entry tool SENTINEL-gated", () => {
    const ungated: string[] = [];
    for (const name of EDIT_TOOLS) {
      if (!/^cw_(create|update|replace|copy|delete)_/.test(name)) continue;
      const keys = shapeKeys(l1[name]);
      if (!keys.includes("user_intent") || !keys.includes("user_quote")) {
        ungated.push(name);
      }
    }
    expect(ungated).toStrictEqual([]);
  });

  it("does not hand L1 time-sheet approval", () => {
    // Approving or reversing a submitted sheet is an L2/L3 responsibility;
    // L1 edits its own entries, it does not sign them off.
    for (const name of [
      "cw_approve_time_sheet",
      "cw_reject_time_sheet",
      "cw_reverse_time_sheet",
    ]) {
      expect(name in l1, `${name} should not be in l1`).toBe(false);
    }
  });

  it("does not hand L1 write access to the shared rate/type reference data", () => {
    // L1 reads work types, charge codes and work roles to fill fields in; it has
    // no business redefining them for everyone else.
    for (const name of [
      "cw_create_work_type",
      "cw_update_work_type",
      "cw_delete_work_type",
      "cw_create_charge_code",
      "cw_update_charge_code",
      "cw_delete_charge_code",
    ]) {
      expect(name in l1, `${name} should not be in l1`).toBe(false);
    }
  });
});
