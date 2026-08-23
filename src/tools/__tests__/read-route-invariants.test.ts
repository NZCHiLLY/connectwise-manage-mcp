/**
 * Read-route invariants.
 *
 * Two defects reached production together in August 2026 and cost Ann a day
 * chasing raw API keys she should never have needed:
 *
 *  - cw_run_report was wired to /system/reports/{name}/count, so it reported
 *    "71 matching payments" and never handed over a row.
 *  - cw_get_report hit the row path but declared no conditions/page/pageSize,
 *    so it could only ever return the oldest 25 rows.
 *
 * Neither was caught by the smoke test, which checks that tools register and
 * carry schemas but never looks at the route a handler actually calls. These
 * tests drive every read tool's handler against a mock client and assert on the
 * path and options it produces, so the same two shapes cannot come back.
 *
 * Deliberately runtime rather than a source scan: the route is built inside the
 * handler from a template literal, and only a real call reveals it.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

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

const getCalls: { path: string; options?: Record<string, unknown> }[] = [];

const mockClient = {
  get: vi.fn((path: string, options?: Record<string, unknown>) => {
    getCalls.push({ path, options });
    // Shaped so handlers that index into a list result don't throw.
    return Promise.resolve([{ id: 1, identifier: "x", defaultWorkRole: { id: 1 } }]);
  }),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
  request: vi.fn().mockResolvedValue({}),
  companyId: "x",
} as unknown as CwManageClient;

interface ToolEntry {
  inputSchema?: { shape?: Record<string, unknown>; _def?: { shape?: () => Record<string, unknown> } };
  handler: (args: unknown, extra: object) => Promise<unknown>;
}

function shapeOf(tool: ToolEntry): Record<string, unknown> {
  const s = tool.inputSchema;
  if (typeof s?._def?.shape === "function") return s._def.shape();
  return s?.shape ?? {};
}

/**
 * Build the minimum args a handler needs. Only required fields are filled —
 * supplying optional ones would mask a tool that fails to forward them.
 */
function minimalArgs(tool: ToolEntry): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(shapeOf(tool))) {
    const f = field as { isOptional?: () => boolean; _def?: { typeName?: string } };
    if (typeof f?.isOptional === "function" && f.isOptional()) continue;
    args[key] = key.toLowerCase().endsWith("id") || key === "id" ? 1 : "x";
  }
  return args;
}

let allTools: Record<string, ToolEntry>;

beforeAll(() => {
  const server = new McpServer({ name: "cw-read-invariants", version: "0.0.0" });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allTools = (server as any)._registeredTools;
});

/** Call one tool and return every path/options pair it produced. */
async function probe(name: string) {
  const tool = allTools[name];
  getCalls.length = 0;
  try {
    await tool.handler(minimalArgs(tool), {});
  } catch {
    // A handler may reject on dummy args (no match found, and so on). Whatever
    // it called before rejecting is still the route we want to assert on.
  }
  return [...getCalls];
}

function readToolNames(prefix: string): string[] {
  return Object.keys(allTools)
    .filter((n) => n.startsWith(prefix))
    .sort();
}

describe("count routes belong to count tools and nothing else", () => {
  it("has tools to check", () => {
    expect(readToolNames("cw_count_").length).toBeGreaterThan(0);
  });

  it("every cw_count_* tool actually hits a /count route", async () => {
    const offenders: string[] = [];
    for (const name of readToolNames("cw_count_")) {
      const calls = await probe(name);
      if (calls.length && !calls.some((c) => c.path.replace(/\/$/, "").endsWith("/count"))) {
        offenders.push(`${name} -> ${calls.map((c) => c.path).join(", ")}`);
      }
    }
    expect(offenders).toStrictEqual([]);
  });

  it("no row-returning read tool hits a /count route", async () => {
    // This is the cw_run_report defect: a tool that promises rows and returns
    // {"count": n}. A count route under any other name is the same bug.
    const offenders: string[] = [];
    for (const prefix of ["cw_get_", "cw_list_", "cw_search_", "cw_run_"]) {
      for (const name of readToolNames(prefix)) {
        const calls = await probe(name);
        for (const c of calls) {
          if (c.path.replace(/\/$/, "").endsWith("/count")) {
            offenders.push(`${name} -> ${c.path}`);
          }
        }
      }
    }
    expect(offenders).toStrictEqual([]);
  });
});

describe("collection reads are pageable", () => {
  // cw_get_report returned rows with no way to filter or page, so it silently
  // capped at CW's default 25 and could not be aimed at a date. Any tool that
  // returns a collection has to expose and forward paging.
  it("every cw_list_* and cw_search_* tool declares and forwards pageSize", async () => {
    const offenders: string[] = [];
    for (const prefix of ["cw_list_", "cw_search_"]) {
      for (const name of readToolNames(prefix)) {
        const declared = "pageSize" in shapeOf(allTools[name]);
        const calls = await probe(name);
        const forwarded = calls.some(
          (c) => c.options !== undefined && "pageSize" in (c.options ?? {}),
        );
        if (!declared || (calls.length > 0 && !forwarded)) {
          offenders.push(`${name} (declared=${declared}, forwarded=${forwarded})`);
        }
      }
    }
    expect(offenders).toStrictEqual([]);
  });

  it("cw_run_report and cw_get_report both forward the full filter set", async () => {
    // The two tools Ann hit. Both return report rows, so both need the filters
    // or the caller cannot reach a specific day.
    for (const name of ["cw_run_report", "cw_get_report"]) {
      const shape = shapeOf(allTools[name]);
      for (const field of ["conditions", "page", "pageSize", "orderBy"]) {
        expect(shape, `${name} is missing ${field}`).toHaveProperty(field);
      }
      const calls = await probe(name);
      expect(calls[0].path).toBe("/system/reports/x");
      expect(calls[0].options).toHaveProperty("conditions");
      expect(calls[0].options).toHaveProperty("pageSize");
    }
  });
});
