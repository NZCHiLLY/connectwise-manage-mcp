/**
 * Every ticket write leaves one internal note on the ticket saying what was
 * done and why, written only after the change succeeds. A failed note never
 * turns the change into an error: the caller gets a WARNING item instead.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerTicketTools } from "../tickets.js";
import { resolveCallerMemberId } from "../../attribution.js";
import { __resetAuditNoteCache } from "../../audit/ticket-note.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../attribution.js", () => ({
  resolveCallerMemberId: vi.fn(),
}));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const put = vi.fn();
const request = vi.fn();
const mockClient = { get, post, patch, put, request, companyId: "example", apiBase: "https://cw.example.com" } as unknown as CwManageClient;

const resolve = resolveCallerMemberId as unknown as ReturnType<typeof vi.fn>;

const SENTINEL = {
  user_intent: "the user asked for this ticket change to be made",
  user_quote: "please do it, verbatim quote words",
};

const HEADER = "Changed by Claude for Alex Example (ConnectWise MCP).";
const NOTE_PATH = /^\/service\/tickets\/\d+\/notes$/;

type Routes = Record<string, unknown>;
let getRoutes: Routes;
let postRoutes: Routes;

function call(name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool.handler({ ...args, ...SENTINEL }, {}) as Promise<{ content: { type: string; text: string }[] }>;
}

let expectedHeader = HEADER;

function lastChangeOrder(): number {
  const changePosts = post.mock.calls.flatMap((c, i) =>
    NOTE_PATH.test(String(c[0])) ? [] : [post.mock.invocationCallOrder[i]]);
  return Math.max(
    0,
    ...patch.mock.invocationCallOrder,
    ...put.mock.invocationCallOrder,
    ...request.mock.invocationCallOrder,
    ...changePosts,
  );
}

/** Every audit note POSTed, each checked for its flags, header, Why line and timing. */
function notePosts(): { path: string; body: Record<string, unknown> }[] {
  const lastChange = lastChangeOrder();
  return post.mock.calls.flatMap((c, i) => {
    if (!NOTE_PATH.test(String(c[0]))) return [];
    const body = c[1] as Record<string, unknown>;
    expect(body).toMatchObject({
      internalAnalysisFlag: true,
      detailDescriptionFlag: false,
      resolutionFlag: false,
      processNotifications: false,
    });
    expect(String(body.text).split("\n")[0]).toBe(expectedHeader);
    expect(String(body.text).endsWith(`\nWhy: ${SENTINEL.user_intent}`)).toBe(true);
    expect(post.mock.invocationCallOrder[i]).toBeGreaterThan(lastChange);
    return [{ path: String(c[0]), body }];
  });
}

function onlyNote(ticketId: number): Record<string, unknown> {
  const notes = notePosts();
  expect(notes.map((n) => n.path)).toStrictEqual([`/service/tickets/${ticketId}/notes`]);
  return notes[0].body;
}

function whatOf(body: Record<string, unknown>): string {
  const line = String(body.text).split("\n").find((l) => l.startsWith("What: "));
  return line?.slice("What: ".length) ?? "";
}

let server: McpServer;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  __resetAuditNoteCache();
  expectedHeader = HEADER;
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  resolve.mockResolvedValue(7);
  getRoutes = { "/system/members/7": { firstName: "Alex", lastName: "Example" } };
  postRoutes = {};
  get.mockImplementation(async (path: string) => {
    if (!(path in getRoutes)) return {};
    const v = getRoutes[path];
    if (v instanceof Error) throw v;
    return v;
  });
  post.mockImplementation(async (path: string) => {
    if (NOTE_PATH.test(path) && !(path in postRoutes)) return { id: 5999 };
    const v = postRoutes[path];
    if (v instanceof Error) throw v;
    return v ?? {};
  });
  patch.mockResolvedValue({});
  put.mockResolvedValue({});
  request.mockResolvedValue({});
  server = new McpServer({ name: "cw-ticket-audit-notes", version: "0.0.0" });
  registerTicketTools(server, mockClient);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("note body", () => {
  it("is one internal note, authored as the caller, with no notifications and no user_quote", async () => {
    postRoutes["/service/tickets"] = { id: 1001 };
    await call("cw_create_ticket", { summary: "Printer down" });
    const body = onlyNote(1001);
    expect(body).toStrictEqual({
      text: `${HEADER}\nWhat: Created this ticket.\nWhy: ${SENTINEL.user_intent}`,
      internalAnalysisFlag: true,
      detailDescriptionFlag: false,
      resolutionFlag: false,
      processNotifications: false,
      member: { id: 7 },
    });
    expect(String(body.text)).not.toContain(SENTINEL.user_quote);
  });

  it("is written after the change", async () => {
    postRoutes["/service/tickets"] = { id: 1001 };
    await call("cw_create_ticket", { summary: "Printer down" });
    expect(post.mock.calls.map((c) => c[0])).toStrictEqual(["/service/tickets", "/service/tickets/1001/notes"]);
  });

  it("names the shared service account and sends no member when the caller does not resolve", async () => {
    resolve.mockResolvedValue(undefined);
    expectedHeader = "Changed by Claude via the ConnectWise MCP (shared service account).";
    postRoutes["/service/tickets"] = { id: 1001 };
    await call("cw_create_ticket", { summary: "Printer down" });
    const body = onlyNote(1001);
    expect(body).not.toHaveProperty("member");
  });
});

describe("cw_update_ticket and cw_replace_ticket", () => {
  it("reads the changed fields first and records each change by name", async () => {
    getRoutes["/service/tickets/1001"] = {
      summary: "Printer down",
      status: { id: 1, name: "New (Portal)" },
      owner: { id: 7, identifier: "aexample", name: "Alex Example" },
    };
    patch.mockResolvedValue({
      id: 1001,
      summary: "Printer down",
      status: { id: 5, name: "Completed" },
      owner: { id: 8, identifier: "sexample", name: "Sam Example" },
    });
    await call("cw_update_ticket", { id: 1001, summary: "Printer down", statusId: 5, ownerId: 8 });
    expect(get).toHaveBeenCalledWith("/service/tickets/1001", { fields: "summary,status,owner" });
    expect(get.mock.invocationCallOrder[0]).toBeLessThan(patch.mock.invocationCallOrder[0]);
    expect(whatOf(onlyNote(1001))).toBe("Status New (Portal) -> Completed. Owner Alex Example -> Sam Example.");
  });

  it("a failed before-read does not block the change and the note falls back to after values", async () => {
    getRoutes["/service/tickets/1001"] = new Error("ConnectWise API error 403: Forbidden");
    patch.mockResolvedValue({ id: 1001, status: { id: 5, name: "Completed" } });
    const result = await call("cw_update_ticket", { id: 1001, statusId: 5 });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(whatOf(onlyNote(1001))).toBe("Status set to Completed.");
    expect(result.content).toHaveLength(1);
  });

  it("replace records only the fields whose value changed", async () => {
    getRoutes["/service/tickets/1001"] = { summary: "Old summary", status: { id: 5, name: "Completed" } };
    put.mockResolvedValue({ id: 1001, summary: "New summary", status: { id: 5, name: "Completed" } });
    await call("cw_replace_ticket", { id: 1001, body: { id: 1001, summary: "New summary", status: { id: 5 }, _info: {} } });
    expect(get).toHaveBeenCalledWith("/service/tickets/1001", { fields: "summary,status" });
    expect(whatOf(onlyNote(1001))).toBe("Summary Old summary -> New summary.");
  });
});

describe("cw_merge_tickets", () => {
  beforeEach(() => {
    for (const id of [1001, 1002, 1003]) {
      getRoutes[`/service/tickets/${id}`] = { id, closedFlag: id === 1001, agreement: { id: 501 } };
    }
    getRoutes["/time/entries/count"] = { count: 0 };
  });

  it("notes the target only, naming the merged tickets and the overrides used", async () => {
    await call("cw_merge_tickets", { targetTicketId: 1001, mergeTicketIds: [1002, 1003], allowClosedTarget: true });
    expect(whatOf(onlyNote(1001))).toBe(
      "Merged ticket(s) #1002, #1003 into this ticket. Overrides used: allowClosedTarget.",
    );
  });

  it("a refused merge writes no note", async () => {
    await expect(call("cw_merge_tickets", { targetTicketId: 1001, mergeTicketIds: [1002] })).rejects.toThrow(/closed/);
    expect(notePosts()).toStrictEqual([]);
  });
});

describe("cw_copy_ticket and cw_convert_ticket_from_survey", () => {
  it("copy notes the new ticket and the source", async () => {
    postRoutes["/service/tickets/1001/copy"] = { id: 1004 };
    await call("cw_copy_ticket", { id: 1001 });
    const notes = notePosts();
    expect(notes.map((n) => [n.path, whatOf(n.body)])).toStrictEqual([
      ["/service/tickets/1004/notes", "Copied from ticket #1001."],
      ["/service/tickets/1001/notes", "Copied to ticket #1004."],
    ]);
  });

  it("convert notes the resulting ticket", async () => {
    postRoutes["/service/tickets/1001/convertFromSurvey"] = { id: 1005 };
    await call("cw_convert_ticket_from_survey", { id: 1001 });
    expect(whatOf(onlyNote(1005))).toBe("Created this ticket from the survey response on ticket #1001.");
  });
});

describe("ticket notes", () => {
  it("an edit names the note and the fields, not the new text", async () => {
    await call("cw_update_ticket_note", {
      ticketId: 1001, noteId: 5001, patch: [{ op: "replace", path: "/text", value: "replacement wording here" }],
    });
    const body = onlyNote(1001);
    expect(whatOf(body)).toBe("Edited note #5001 (text).");
    expect(String(body.text)).not.toContain("replacement wording here");
  });

  it("a delete describes the note and never contains the deleted text", async () => {
    getRoutes["/service/tickets/1001/notes/5001"] = {
      id: 5001,
      internalAnalysisFlag: true,
      member: { id: 7, name: "Alex Example" },
      dateCreated: "2026-11-20T01:00:00Z",
      text: "the words that were deleted",
    };
    await call("cw_delete_ticket_note", { ticketId: 1001, noteId: 5001 });
    const readParams = get.mock.calls.find((c) => c[0] === "/service/tickets/1001/notes/5001")?.[1] as { fields: string };
    expect(readParams.fields.split(",")).not.toContain("text");
    expect(get.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]);
    const body = onlyNote(1001);
    expect(whatOf(body)).toBe("Deleted note #5001 (internal note by Alex Example, dated 2026-11-20).");
    expect(String(body.text)).not.toContain("the words that were deleted");
  });

  it("cw_add_ticket_note writes exactly one note, its own", async () => {
    await call("cw_add_ticket_note", { ticketId: 1001, text: "Visited site" });
    expect(post).toHaveBeenCalledTimes(1);
    expect((post.mock.calls[0][1] as Record<string, unknown>).text).toBe("Visited site");
  });
});

describe("ticket tasks", () => {
  it("create names the new task and the first 120 characters of its notes", async () => {
    postRoutes["/service/tickets/1001/tasks"] = { id: 6001 };
    await call("cw_create_ticket_task", { ticketId: 1001, notes: "a".repeat(200) });
    expect(whatOf(onlyNote(1001))).toBe(`Added task #6001: ${"a".repeat(120)}...`);
  });

  it("update records the field change", async () => {
    getRoutes["/service/tickets/1001/tasks/6001"] = { closedFlag: false };
    patch.mockResolvedValue({ id: 6001, closedFlag: true });
    await call("cw_update_ticket_task", {
      ticketId: 1001, taskId: 6001, patch: [{ op: "replace", path: "/closedFlag", value: true }],
    });
    expect(whatOf(onlyNote(1001))).toBe("Updated task #6001: Done no -> yes.");
  });

  it("delete reads the task first and names it", async () => {
    getRoutes["/service/tickets/1001/tasks/6001"] = { id: 6001, notes: "Call the vendor" };
    await call("cw_delete_ticket_task", { ticketId: 1001, taskId: 6001 });
    expect(get.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]);
    expect(whatOf(onlyNote(1001))).toBe("Removed task #6001: Call the vendor");
  });
});

describe("ticket resources", () => {
  it("add names the member from the new schedule entry", async () => {
    postRoutes["/schedule/entries"] = { id: 8001, member: { id: 7, identifier: "aexample", name: "Alex Example" } };
    await call("cw_add_ticket_team_member", { ticketId: 1001, memberId: 7 });
    expect(whatOf(onlyNote(1001))).toBe("Added Alex Example as a resource on this ticket (schedule entry #8001).");
  });

  it("cw_add_ticket_member names the member", async () => {
    postRoutes["/schedule/entries"] = { id: 8001, member: { id: 7, identifier: "aexample" } };
    await call("cw_add_ticket_member", { id: 1001, memberIdentifier: "aexample" });
    expect(whatOf(onlyNote(1001))).toBe("Added aexample as a resource on this ticket (schedule entry #8001).");
  });

  it("update names the member and the change", async () => {
    getRoutes["/schedule/entries/8001"] = { member: { id: 7, name: "Alex Example" }, doneFlag: false };
    patch.mockResolvedValue({ id: 8001, doneFlag: true });
    await call("cw_update_ticket_team_member", {
      ticketId: 1001, teamMemberId: 8001, patch: [{ op: "replace", path: "/doneFlag", value: true }],
    });
    expect(whatOf(onlyNote(1001))).toBe(
      "Updated the resource assignment for Alex Example (schedule entry #8001): Done no -> yes.",
    );
  });

  it("update notes the ticket the schedule entry belongs to, not a mistyped ticketId", async () => {
    getRoutes["/schedule/entries/8001"] = { member: { id: 7, name: "Alex Example" }, objectId: 1009, type: { id: 4 }, doneFlag: false };
    patch.mockResolvedValue({ id: 8001, doneFlag: true });
    await call("cw_update_ticket_team_member", {
      ticketId: 1001, teamMemberId: 8001, patch: [{ op: "replace", path: "/doneFlag", value: true }],
    });
    expect(get).toHaveBeenCalledWith("/schedule/entries/8001", { fields: "member,objectId,type,doneFlag" });
    onlyNote(1009);
  });

  it("remove notes the ticket the schedule entry belongs to", async () => {
    getRoutes["/schedule/entries/8001"] = { id: 8001, member: { id: 7, name: "Alex Example" }, objectId: 1009, type: { id: 4 } };
    await call("cw_remove_ticket_team_member", { ticketId: 1001, teamMemberId: 8001 });
    onlyNote(1009);
  });

  it("remove reads the entry first and names the member", async () => {
    getRoutes["/schedule/entries/8001"] = { id: 8001, member: { id: 7, name: "Alex Example" } };
    await call("cw_remove_ticket_team_member", { ticketId: 1001, teamMemberId: 8001 });
    expect(get.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]);
    expect(whatOf(onlyNote(1001))).toBe("Removed Alex Example as a resource from this ticket (schedule entry #8001).");
  });
});

describe("ticket configurations", () => {
  beforeEach(() => {
    getRoutes["/company/configurations/7001"] = { id: 7001, name: "Example Laptop" };
  });

  it("attach names the configuration", async () => {
    await call("cw_attach_configuration_to_ticket", { ticketId: 1001, configurationId: 7001 });
    expect(whatOf(onlyNote(1001))).toBe('Attached configuration "Example Laptop" (#7001) to this ticket.');
  });

  it("detach names the configuration", async () => {
    await call("cw_detach_configuration_from_ticket", { ticketId: 1001, configurationId: 7001 });
    expect(whatOf(onlyNote(1001))).toBe('Detached configuration "Example Laptop" (#7001) from this ticket.');
  });
});

describe("failure handling", () => {
  it("a failed change writes no note", async () => {
    patch.mockRejectedValue(new Error("ConnectWise API error 400: bad status"));
    await expect(call("cw_update_ticket", { id: 1001, statusId: 5 })).rejects.toThrow("bad status");
    expect(notePosts()).toStrictEqual([]);
  });

  it("a failed create writes no note", async () => {
    postRoutes["/service/tickets"] = new Error("ConnectWise API error 400: summary required");
    await expect(call("cw_create_ticket", { summary: "x" })).rejects.toThrow("summary required");
    expect(notePosts()).toStrictEqual([]);
  });

  it("a failed note returns the normal success result plus a WARNING item", async () => {
    patch.mockResolvedValue({ id: 1001, status: { id: 5, name: "Completed" } });
    postRoutes["/service/tickets/1001/notes"] = new Error("ConnectWise API error 500: note store down");
    const result = await call("cw_update_ticket", { id: 1001, statusId: 5 });
    expect(result.content).toHaveLength(2);
    expect(JSON.parse(result.content[0].text)).toStrictEqual({ id: 1001, status: { id: 5, name: "Completed" } });
    expect(result.content[1]).toStrictEqual({
      type: "text",
      text: "WARNING: the change succeeded but the internal audit note could not be written " +
        "(ConnectWise API error 500: note store down). Add an internal note to ticket 1001 by hand saying what was done and why.",
    });
    const logs = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).filter((l: string) => l.startsWith("[audit-note]"));
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toContain(SENTINEL.user_intent);
  });

  it("a response with no ticket id gives a WARNING rather than a note on a guessed ticket", async () => {
    postRoutes["/service/tickets"] = {};
    const result = await call("cw_create_ticket", { summary: "Printer down" });
    expect(notePosts()).toStrictEqual([]);
    expect(result.content[1].text).toMatch(/^WARNING: .*ticket \(id unknown\) by hand/);
  });
});

describe("cw_delete_ticket", () => {
  it("is not registered", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((server as any)._registeredTools).not.toHaveProperty("cw_delete_ticket");
  });
});
