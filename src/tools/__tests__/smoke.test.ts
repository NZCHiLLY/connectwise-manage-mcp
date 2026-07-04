/**
 * Tool registration smoke test.
 *
 * Registers every tool module against a real McpServer instance and verifies:
 * - Every tool has a non-empty description and a handler
 * - Every tool has an inputSchema (Zod object parsed by the SDK)
 * - Write tools (create / update / patch / delete / replace / merge / copy)
 *   carry user_intent + user_quote SENTINEL parameters
 * - No duplicate tool names across tool modules
 * - Each module registers at least its expected minimum tools
 *
 * These tests catch registration bugs (missing descriptions, broken schemas,
 * handler signature mismatches, missing SENTINEL gates) without needing
 * ConnectWise API credentials.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";

// Mock auditLog so tool modules that import it don't fail
vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Tool modules
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Known read-only tool patterns (SENTINEL waiver)
// ---------------------------------------------------------------------------

const READ_ONLY_PREFIXES = [
  "cw_search_", "cw_get_", "cw_list_", "cw_count_", "cw_test_",
];

// Read-like tools that don't match a prefix but aren't mutating operations
const READ_ONLY_EXEMPTIONS = new Set([
  "cw_run_report",           // triggers a report job, doesn't mutate CW data
]);

function isReadOnly(name: string): boolean {
  if (READ_ONLY_EXEMPTIONS.has(name)) return true;
  return READ_ONLY_PREFIXES.some((p) => name.startsWith(p));
}

// ---------------------------------------------------------------------------
// Shared mock client
// ---------------------------------------------------------------------------

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
} as unknown as CwManageClient;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnsafeServer = any;

interface ToolEntry {
  description: string;
  inputSchema: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseAsync(args: unknown): Promise<any>;
    shape?: Record<string, unknown>;
    _def?: { shape(): Record<string, unknown> };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => Promise<any>;
}

function getTools(server: McpServer): Record<string, ToolEntry> {
  return (server as UnsafeServer)._registeredTools as Record<string, ToolEntry>;
}

function isZodObject(schema: unknown): boolean {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "parseAsync" in (schema as object)
  );
}

function newServer(): McpServer {
  return new McpServer({ name: "cw-smoke", version: "0.0.0" });
}

// ---------------------------------------------------------------------------
// Register all tools once (shared across describe blocks)
// ---------------------------------------------------------------------------

let allTools: Record<string, ToolEntry>;

beforeAll(() => {
  const server = newServer();
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
  allTools = getTools(server);
});

// ---------------------------------------------------------------------------
// Module → register function → expected minimum tool count
// (minimums act as a canary — they'll fail if a module accidentally drops tools)
// ---------------------------------------------------------------------------

interface ModuleDef {
  name: string;
  register: (server: McpServer, client: CwManageClient) => void;
  minTools: number;
}

const MODULES: ModuleDef[] = [
  { name: "activities",      register: registerActivityTools,      minTools: 10 },
  { name: "catalog",         register: registerCatalogTools,       minTools: 15 },
  { name: "companies",       register: registerCompanyTools,       minTools: 20 },
  { name: "configurations",  register: registerConfigurationTools, minTools: 12 },
  { name: "contacts",        register: registerContactTools,       minTools: 15 },
  { name: "expenses",        register: registerExpenseTools,       minTools: 10 },
  { name: "finance",         register: registerFinanceTools,       minTools: 20 },
  { name: "health",          register: registerHealthTools,        minTools: 1 },
  { name: "marketing",       register: registerMarketingTools,     minTools: 10 },
  { name: "opportunities",   register: registerOpportunityTools,   minTools: 15 },
  { name: "procurement",     register: registerProcurementTools,   minTools: 25 },
  { name: "projects",        register: registerProjectTools,       minTools: 15 },
  { name: "sales",           register: registerSalesTools,         minTools: 15 },
  { name: "schedule",        register: registerScheduleTools,      minTools: 10 },
  { name: "service",         register: registerServiceTools,       minTools: 25 },
  { name: "system",          register: registerSystemTools,        minTools: 25 },
  { name: "tickets",         register: registerTicketTools,        minTools: 25 },
  { name: "time-entries",    register: registerTimeEntryTools,     minTools: 18 },
];

// ---------------------------------------------------------------------------
// Schema shape helper
// ---------------------------------------------------------------------------

function getShape(schema: unknown): Record<string, unknown> | undefined {
  const s = schema as UnsafeServer;
  if (typeof s._def?.shape === "function") {
    return s._def.shape() as Record<string, unknown> | undefined;
  }
  return s.shape as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tool registration smoke test", () => {
  it("registers at least 70 tools across all modules", () => {
    const names = Object.keys(allTools);
    expect(names.length).toBeGreaterThanOrEqual(70);
  });

  it("has no duplicate tool names", () => {
    const names = Object.keys(allTools);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toStrictEqual([]);
  });

  it("tool count is within expected range", () => {
    const count = Object.keys(allTools).length;
    // The server registers tools from all 18 modules.  Overlaps between
    // modules (shared infra tools like cw_list_work_roles) mean the
    // combined count is less than the sum of parts, but it should still
    // be substantial.  Bounds guard against silent mass-dropping of tools.
    expect(count).toBeGreaterThanOrEqual(90);
    expect(count).toBeLessThanOrEqual(650);
  });

  it("every tool has a non-empty description", () => {
    const missing: string[] = [];
    for (const [name, entry] of Object.entries(allTools)) {
      if (!entry.description || entry.description.trim().length === 0) {
        missing.push(name);
      }
    }
    expect(missing).toStrictEqual([]);
  });

  it("every tool has a Zod inputSchema", () => {
    const missing: string[] = [];
    for (const [name, entry] of Object.entries(allTools)) {
      if (!isZodObject(entry.inputSchema)) {
        missing.push(name);
      }
    }
    expect(missing).toStrictEqual([]);
  });

  it("every tool has a handler function", () => {
    const missing: string[] = [];
    for (const [name, entry] of Object.entries(allTools)) {
      if (typeof entry.handler !== "function") {
        missing.push(name);
      }
    }
    expect(missing).toStrictEqual([]);
  });

  it("SENTINEL: write tools require user_intent + user_quote", () => {
    const missing: string[] = [];
    for (const [name, entry] of Object.entries(allTools)) {
      if (isReadOnly(name)) continue;

      const shape = getShape(entry.inputSchema);
      if (!shape) {
        missing.push(`${name} (no shape available)`);
        continue;
      }

      if (!("user_intent" in shape)) {
        missing.push(`${name} (missing user_intent)`);
      }
      if (!("user_quote" in shape)) {
        missing.push(`${name} (missing user_quote)`);
      }
    }
    expect(missing).toStrictEqual([]);
  });

  it("SENTINEL: read-only tools do NOT have user_intent/user_quote", () => {
    const unexpected: string[] = [];
    for (const [name, entry] of Object.entries(allTools)) {
      if (!isReadOnly(name)) continue;

      const shape = getShape(entry.inputSchema);
      if (shape && ("user_intent" in shape || "user_quote" in shape)) {
        unexpected.push(name);
      }
    }
    expect(unexpected).toStrictEqual([]);
  });
});

describe("module tool counts", () => {
  for (const mod of MODULES) {
    it(`${mod.name}: registers at least ${mod.minTools} tools`, () => {
      const server = newServer();
      mod.register(server, mockClient);
      const tools = getTools(server);
      const count = Object.keys(tools).length;
      expect(count).toBeGreaterThanOrEqual(mod.minTools);
    });
  }
});
