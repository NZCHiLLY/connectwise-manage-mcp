/**
 * Output shaping wired into the applyToolProfile choke point.
 *
 * Calls go through the SDK's own input validation (`validateToolInput`, the step that
 * strips undeclared keys) before the registered handler, so a test passes only if an
 * injected field really survives the schema. One block also runs tools/list and
 * tools/call end to end over the SDK's in-memory transport.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CwManageClient } from "../../api-client.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  auditOutcome: vi.fn().mockResolvedValue(undefined),
}));

import { applyToolProfile, isShapedProfile, SHAPED_PROFILES_DEFAULT } from "../profiles.js";
import { CONDITIONS_HELP, ORDERBY_HELP } from "../shaping.js";
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
import { requestContext } from "../../context.js";

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
} as unknown as CwManageClient & { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

function build(profile: string | undefined): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const proxy = applyToolProfile(server, profile);
  registerConfigurationTools(proxy, mockClient);
  registerTicketTools(proxy, mockClient);
  return server;
}

/** Validates through the SDK's own tools/call input step, then runs the handler. */
async function call(server: McpServer, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const s = server as unknown as {
    _registeredTools: Record<string, { handler: (a: unknown, extra: object) => Promise<unknown> }>;
    validateToolInput(tool: unknown, args: unknown, name: string): Promise<unknown>;
  };
  const tool = s._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not registered`);
  const parsed = await s.validateToolInput(tool, args, name);
  return (await tool.handler(parsed, {})) as ToolResult;
}

function shapeOf(server: McpServer, name: string): Record<string, { description?: string }> {
  const tool = (server as unknown as {
    _registeredTools: Record<string, { inputSchema: { _zod: { def: { shape: Record<string, { description?: string }> } } } }>;
  })._registeredTools[name];
  return tool.inputSchema._zod.def.shape;
}

const DISCLAIMER =
  "This message and its attachments contain confidential information. If you are not the intended recipient, you are strictly prohibited to disclose, copy, distribute or take any action in reliance on the contents of this information. Any views expressed are those of the sender. No liability is accepted for any viruses transmitted by this email.";

const CONFIG = {
  id: 25,
  name: "Doc",
  type: { id: 85, name: "Misc", _info: { type_href: "https://cw.example/types/85" } },
  questions: [{ answer: "x" }],
  notes: "",
  _info: { lastUpdated: "2026-11-01T00:00:00Z", configuration_href: "https://cw.example/c/25" },
};

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.MCP_SHAPED_PROFILES;
});

afterEach(() => {
  delete process.env.MCP_SHAPED_PROFILES;
});

describe("shaping wired into applyToolProfile", () => {
  it("fields works on a tool that never declared it", async () => {
    mockClient.get.mockResolvedValue([{ id: 25, name: "Doc", type: { id: 85, name: "Misc" }, questions: [{ answer: "x" }] }]);
    const res = await call(build("l2"), "cw_search_configurations", { fields: "id,name" });
    expect(JSON.parse(res.content[0].text).items).toStrictEqual([{ id: 25, name: "Doc" }]);
  });

  it("l1 output is compact and wrapped", async () => {
    mockClient.get.mockResolvedValue([CONFIG]);
    const res = await call(build("l1"), "cw_search_configurations", {});
    const text = res.content[0].text;
    // _info keeps its scalar dates by design (Task 3), so the check is on what compaction drops.
    expect(text).not.toContain("_href");
    expect(text).not.toContain("\n");
    expect(text).not.toContain('"notes"');
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("items");
    expect(parsed.items[0]._info).toStrictEqual({ lastUpdated: "2026-11-01T00:00:00Z" });
    expect(parsed.returned).toBe(1);
  });

  it("full profile output is unchanged", async () => {
    const mockValue = [CONFIG, { ...CONFIG, id: 26, name: null }];
    mockClient.get.mockResolvedValue(mockValue);
    const res = await call(build(undefined), "cw_search_configurations", { conditions: "name = \"Doc\"" });
    expect(res.content[0].text).toBe(JSON.stringify(mockValue, null, 2));
  });

  it("full profile output is unchanged for an explicit full profile", async () => {
    mockClient.get.mockResolvedValue(CONFIG);
    const res = await call(build("full"), "cw_get_configuration", { id: 25 });
    expect(res.content[0].text).toBe(JSON.stringify(CONFIG, null, 2));
  });

  it("full profile with fields projects only, keeping the indentation", async () => {
    mockClient.get.mockResolvedValue([CONFIG]);
    const res = await call(build(undefined), "cw_search_configurations", { fields: "id, type/name" });
    expect(res.content[0].text).toBe(JSON.stringify([{ id: 25, type: { name: "Misc" } }], null, 2));
  });

  it("projection is idempotent on tools that already declare fields", async () => {
    const server = build("l1");
    const full = { id: 7, summary: "Printer", board: { id: 1, name: "Service" }, _info: { dateEntered: "2026-11-01T00:00:00Z" } };
    mockClient.get.mockResolvedValueOnce(full).mockResolvedValueOnce({ id: 7, summary: "Printer" });
    const a = await call(server, "cw_get_ticket", { id: 7, fields: "id,summary" });
    const b = await call(server, "cw_get_ticket", { id: 7, fields: "id,summary" });
    expect(a.content[0].text).toBe(b.content[0].text);
    expect(JSON.parse(a.content[0].text)).toStrictEqual({ id: 7, summary: "Printer" });
    // A tool that declares fields natively still forwards it to ConnectWise.
    expect(mockClient.get).toHaveBeenCalledWith("/service/tickets/7", { fields: "id,summary" });
  });

  it("clamps pageSize on shaped profiles", async () => {
    mockClient.get.mockResolvedValue([]);
    await call(build("l1"), "cw_search_tickets", { pageSize: 1000 });
    expect(mockClient.get).toHaveBeenCalledWith("/service/tickets", expect.objectContaining({ pageSize: 100 }));
  });

  it("does not clamp on full", async () => {
    mockClient.get.mockResolvedValue([]);
    await call(build(undefined), "cw_search_tickets", { pageSize: 1000 });
    expect(mockClient.get).toHaveBeenCalledWith("/service/tickets", expect.objectContaining({ pageSize: 1000 }));
  });

  it("conditions descriptions carry the help", () => {
    for (const profile of ["l2", undefined]) {
      const shape = shapeOf(build(profile), "cw_search_configurations");
      expect(shape.conditions.description).toBe(CONDITIONS_HELP);
      expect(shape.orderBy.description).toBe(ORDERBY_HELP);
    }
  });

  it("injects fields only on read tools and maxTextChars only on note tools", () => {
    const server = build("l1");
    expect(shapeOf(server, "cw_search_configurations").fields.description).toBe(
      "Comma-separated fields to keep, for example id,name,company/name.",
    );
    // Native declarations are left as registered.
    expect(shapeOf(server, "cw_search_tickets").fields.description).toBe("Comma-separated fields to return");
    expect(shapeOf(server, "cw_update_ticket").fields).toBeUndefined();
    expect(shapeOf(server, "cw_get_ticket_notes").maxTextChars).toBeDefined();
    expect(shapeOf(server, "cw_search_configurations").maxTextChars).toBeUndefined();
    expect(shapeOf(server, "cw_add_ticket_note").maxTextChars).toBeUndefined();
    expect(shapeOf(server, "cw_update_ticket_note").maxTextChars).toBeUndefined();
  });

  it("error results are not shaped", async () => {
    mockClient.get.mockRejectedValue(new Error("ConnectWise 400: bad conditions"));
    const res = await call(build("l1"), "cw_search_configurations", { fields: "id" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("cw_search_configurations failed: ConnectWise 400: bad conditions");
  });

  it("caps note text at maxTextChars on shaped profiles", async () => {
    mockClient.get.mockResolvedValue([{ id: 1, text: "a".repeat(50) }]);
    const res = await call(build("l1"), "cw_get_ticket_notes", { ticketId: 9, maxTextChars: 10 });
    expect(JSON.parse(res.content[0].text).items[0].text).toBe(`${"a".repeat(10)}[display cut: 40 more characters stored]`);
  });

  it("leaves a write tool's text untouched on shaped profiles", async () => {
    const posted = { id: 77, ticketId: 9, text: `${"b".repeat(5000)}

${DISCLAIMER}` };
    mockClient.post.mockResolvedValue(posted);
    const res = await call(build("l1"), "cw_add_ticket_note", {
      ticketId: 9,
      text: posted.text,
      user_intent: "User asked to add the update note to ticket 9.",
      user_quote: "add the note",
    });
    expect(res.isError).toBeUndefined();
    expect(JSON.parse(res.content[0].text)).toStrictEqual(posted);
  });

  it("normalises query args on every profile", async () => {
    mockClient.get.mockResolvedValue([]);
    await call(build(undefined), "cw_get_ticket_notes", { ticketId: 9, conditions: "dateCreated &gt; [2026-11-01]" });
    expect(mockClient.get).toHaveBeenCalledWith(
      "/service/tickets/9/allNotes",
      expect.objectContaining({ conditions: "_info/dateEntered > [2026-11-01]" }),
    );
  });

  it("uses paging from the request store", async () => {
    const server = build("l1");
    mockClient.get.mockImplementation(async () => {
      const store = requestContext.getStore();
      if (store) store.paging = { hasMore: true, nextPage: 2 };
      return [{ id: 1 }];
    });
    const res = await requestContext.run({ correlationId: "t" }, () => call(server, "cw_search_configurations", {}));
    expect(JSON.parse(res.content[0].text)).toMatchObject({ hasMore: true, nextPage: 2 });
  });

  it("does not pass injected keys to the handler", async () => {
    for (const profile of ["l1", undefined]) {
      const server = new McpServer({ name: "test", version: "0.0.0" });
      const proxy = applyToolProfile(server, profile);
      let seen: unknown;
      proxy.tool("cw_get_ticket_note", "test", { id: z.number() }, async (args: unknown) => {
        seen = args;
        return { content: [{ type: "text", text: "{}" }] };
      });
      await call(server, "cw_get_ticket_note", { id: 1, fields: "id", maxTextChars: 5 });
      expect(seen).toStrictEqual({ id: 1 });
    }
  });
});

describe("recorded worst case", () => {
  // Synthetic, built by scripts/make-oversize-notes-fixture.mjs from the shape of a real allNotes page.
  const FIXTURE = JSON.parse(
    readFileSync(new URL("./fixtures/oversize-notes.json", import.meta.url), "utf8"),
  ) as { id: number; text: string; _info: { dateEntered: string } }[];

  it("a 50-note page that overflowed in October fits after shaping", async () => {
    expect(FIXTURE).toHaveLength(50);
    expect(JSON.stringify(FIXTURE, null, 2).length).toBeGreaterThan(80_000);
    mockClient.get.mockResolvedValue(FIXTURE);
    const res = await call(build("l1"), "cw_get_ticket_notes", { ticketId: 100000, pageSize: 50 });
    const text = res.content[0].text;
    expect(text.length).toBeLessThan(40_000);

    const out = JSON.parse(text) as {
      items: { id: number; text: string; _info: { dateEntered: string } }[];
      returned: number;
      truncated: boolean;
      omitted?: number;
      pageTotal?: number;
    };
    expect(out.returned).toBe(out.items.length);
    if (out.truncated) {
      expect(out.pageTotal).toBe(50);
      expect(out.omitted).toBe(50 - out.returned);
    } else {
      expect(out.returned).toBe(50);
      expect(out.omitted).toBeUndefined();
    }

    const marker = /\[display cut: \d+ more characters stored\]$/;
    out.items.forEach((item, i) => {
      expect(item.id).toBe(FIXTURE[i].id);
      expect(item._info.dateEntered).toBe(FIXTURE[i]._info.dateEntered);
      expect(item.text).not.toContain("This message and its attachments");
      expect(item.text).not.toContain("THIS EMAIL IS FROM AN EXTERNAL SENDER");
      expect(item.text).not.toContain("inlineimages");
      const body = item.text.replace(marker, "");
      expect(body.length).toBeLessThanOrEqual(2000);
      if (marker.test(item.text)) expect(body.length).toBe(2000);
    });
  });
});

describe("isShapedProfile", () => {
  it("shapes the claude.ai tiers and nothing else by default", () => {
    expect(SHAPED_PROFILES_DEFAULT).toStrictEqual(["l1", "l2", "l3", "opportunities", "sales", "pricing"]);
    for (const p of SHAPED_PROFILES_DEFAULT) expect(isShapedProfile(p)).toBe(true);
    for (const p of [undefined, "full", "tickets", "finance-invoices"]) expect(isShapedProfile(p)).toBe(false);
  });

  it("honours MCP_SHAPED_PROFILES when set", () => {
    process.env.MCP_SHAPED_PROFILES = " tickets , l1 ";
    expect(isShapedProfile("tickets")).toBe(true);
    expect(isShapedProfile("l1")).toBe(true);
    expect(isShapedProfile("l2")).toBe(false);
    process.env.MCP_SHAPED_PROFILES = "";
    expect(isShapedProfile("l1")).toBe(false);
    // The untiered endpoint stays raw whatever the variable says.
    process.env.MCP_SHAPED_PROFILES = "full,l1";
    expect(isShapedProfile("full")).toBe(false);
    expect(isShapedProfile(undefined)).toBe(false);
  });
});

describe("end to end through the SDK's tools/list and tools/call", () => {
  async function connect(profile: string | undefined): Promise<Client> {
    const server = build(profile);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(clientTransport);
    return client;
  }

  it("lists the injected fields and the conditions help", async () => {
    const client = await connect("l2");
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "cw_search_configurations");
    const props = tool?.inputSchema.properties as Record<string, { type?: string; description?: string }>;
    expect(props.fields).toMatchObject({ type: "string" });
    expect(props.conditions.description).toBe(CONDITIONS_HELP);
    expect(props.orderBy.description).toBe(ORDERBY_HELP);
    await client.close();
  });

  it("projects on a tool that never declared fields", async () => {
    mockClient.get.mockResolvedValue([CONFIG]);
    const client = await connect("l2");
    const res = (await client.callTool({ name: "cw_search_configurations", arguments: { fields: "id,name" } })) as ToolResult;
    expect(JSON.parse(res.content[0].text).items).toStrictEqual([{ id: 25, name: "Doc" }]);
    await client.close();
  });

  it("lists every tool module through the proxy with fields on every read tool", async () => {
    const modules = [
      registerActivityTools, registerCatalogTools, registerCompanyTools, registerConfigurationTools,
      registerContactTools, registerExpenseTools, registerFinanceTools, registerHealthTools,
      registerMarketingTools, registerOpportunityTools, registerProcurementTools, registerProjectTools,
      registerSalesTools, registerScheduleTools, registerServiceTools, registerSystemTools,
      registerTicketTools, registerTimeEntryTools,
    ];
    const bare = new McpServer({ name: "bare", version: "0.0.0" });
    for (const register of modules) register(bare, mockClient);
    const server = new McpServer({ name: "test", version: "0.0.0" });
    const proxy = applyToolProfile(server, undefined);
    for (const register of modules) register(proxy, mockClient);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.length).toBe(Object.keys((bare as unknown as { _registeredTools: object })._registeredTools).length);
    const readMissing = tools
      .filter((t) => /^cw_(search|list|get|count)_/.test(t.name))
      .filter((t) => !("fields" in ((t.inputSchema.properties ?? {}) as object)))
      .map((t) => t.name);
    expect(readMissing).toStrictEqual([]);
    await client.close();
  });

  it("returns the untiered output byte for byte", async () => {
    mockClient.get.mockResolvedValue([CONFIG]);
    const client = await connect(undefined);
    const res = (await client.callTool({ name: "cw_search_configurations", arguments: {} })) as ToolResult;
    expect(res.content[0].text).toBe(JSON.stringify([CONFIG], null, 2));
    await client.close();
  });
});
