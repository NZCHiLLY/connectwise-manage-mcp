/**
 * "My Company" / "My Account" route defects.
 *
 * Both tools shipped pointing at invented /system routes and 404'd against a
 * live CW cloud instance with "The endpoint does not exist.":
 *
 *   GET /system/myCompany  → not a documented CW route at all
 *   GET /system/myAccount  → documented, but not routed for an API-only member
 *
 * The tenant's own organisation is an ordinary /company/companies record whose
 * identifier matches the company ID used to authenticate, so cw_get_my_company
 * resolves it that way. cw_get_my_account still tries the documented route and
 * degrades to the connection context only on the "endpoint does not exist" 404.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerSystemTools } from "../system.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
  auditOutcome: vi.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  companyId: "Tomizone",
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
  request: vi.fn().mockResolvedValue({}),
} as unknown as CwManageClient;

const asMock = (fn: unknown) =>
  fn as unknown as {
    mock: { calls: unknown[][] };
    mockResolvedValueOnce(v: unknown): void;
    mockRejectedValueOnce(v: unknown): void;
  };

function getTool(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool as {
    description: string;
    handler: (args: unknown, extra: object) => Promise<{
      content: { type: string; text: string }[];
    }>;
  };
}

const parse = (result: { content: { text: string }[] }) =>
  JSON.parse(result.content[0].text) as Record<string, unknown>;

const ENDPOINT_404 =
  'ConnectWise API error 404: {"code":"ConnectWiseApi","message":"The endpoint does not exist."}';

let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  server = new McpServer({ name: "cw-my-company-account", version: "0.0.0" });
  registerSystemTools(server, mockClient);
});

describe("cw_get_my_company resolves the tenant's own company record", () => {
  it("queries /company/companies by the authenticated company identifier", async () => {
    asMock(mockClient.get).mockResolvedValueOnce([{ id: 250, identifier: "Tomizone" }]);
    await getTool(server, "cw_get_my_company").handler({}, {});
    expect(mockClient.get).toHaveBeenCalledWith("/company/companies", {
      conditions: 'identifier="Tomizone"',
      pageSize: 1,
    });
  });

  it("never touches /system/myCompany", async () => {
    asMock(mockClient.get).mockResolvedValueOnce([{ id: 250 }]);
    await getTool(server, "cw_get_my_company").handler({}, {});
    const paths = asMock(mockClient.get).mock.calls.map((c) => String(c[0]));
    expect(paths.some((p) => p.startsWith("/system/myCompany"))).toBe(false);
  });

  it("unwraps the single match rather than returning a one-element array", async () => {
    asMock(mockClient.get).mockResolvedValueOnce([
      { id: 250, identifier: "Tomizone", name: "Tomizone New Zealand Limited" },
    ]);
    const body = parse(await getTool(server, "cw_get_my_company").handler({}, {}));
    expect(body.id).toBe(250);
    expect(body.name).toBe("Tomizone New Zealand Limited");
  });

  it("names the identifier it searched for when nothing matches", async () => {
    asMock(mockClient.get).mockResolvedValueOnce([]);
    await expect(getTool(server, "cw_get_my_company").handler({}, {})).rejects.toThrow(
      /identifier "Tomizone".*cw_search_companies/s,
    );
  });
});

describe("cw_get_my_account degrades only on the unrouted 404", () => {
  it("returns the record verbatim when /system/myAccount is routed", async () => {
    asMock(mockClient.get).mockResolvedValueOnce({ id: 117, identifier: "zAdmin" });
    const result = await getTool(server, "cw_get_my_account").handler({}, {});
    expect(mockClient.get).toHaveBeenCalledWith("/system/myAccount");
    expect(parse(result).identifier).toBe("zAdmin");
  });

  it("reports the connection context instead of a bare 404", async () => {
    asMock(mockClient.get).mockRejectedValueOnce(new Error(ENDPOINT_404));
    asMock(mockClient.get).mockResolvedValueOnce({ version: "v2025.1.10675", cloudRegion: "AU" });
    const body = parse(await getTool(server, "cw_get_my_account").handler({}, {}));
    expect(body.authenticatedAs).toStrictEqual({
      companyId: "Tomizone",
      memberType: "API member",
    });
    expect(body.systemInfo).toStrictEqual({ version: "v2025.1.10675", cloudRegion: "AU" });
    expect(String(body.note)).toMatch(/cw_search_members|cw_get_member/);
  });

  it("still answers when the /system/info fallback also fails", async () => {
    asMock(mockClient.get).mockRejectedValueOnce(new Error(ENDPOINT_404));
    asMock(mockClient.get).mockRejectedValueOnce(new Error("boom"));
    const body = parse(await getTool(server, "cw_get_my_account").handler({}, {}));
    expect(body.systemInfo).toBeNull();
  });

  it("does not swallow unrelated failures", async () => {
    asMock(mockClient.get).mockRejectedValueOnce(
      new Error("ConnectWise API error 401: Invalid credentials"),
    );
    await expect(getTool(server, "cw_get_my_account").handler({}, {})).rejects.toThrow(/401/);
  });

  it("never leaks the private key or auth header", async () => {
    asMock(mockClient.get).mockRejectedValueOnce(new Error(ENDPOINT_404));
    asMock(mockClient.get).mockResolvedValueOnce(null);
    const text = (await getTool(server, "cw_get_my_account").handler({}, {})).content[0].text;
    expect(text.toLowerCase()).not.toMatch(/privatekey|publickey|authorization|basic /);
  });
});
