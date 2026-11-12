import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerHealthTools } from "../health.js";
import { healthPayload } from "../../build-info.js";

const SYSTEM_INFO = { version: "v2026.1", isCloud: true };

const mockClient = {
  get: vi.fn().mockResolvedValue(SYSTEM_INFO),
} as unknown as CwManageClient;

async function callTestConnection(): Promise<string> {
  const server = new McpServer({ name: "t", version: "0" });
  registerHealthTools(server, mockClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools["cw_test_connection"];
  const result = await tool.handler({}, {});
  return result.content[0].text as string;
}

describe("build reporting", () => {
  beforeEach(() => {
    vi.stubEnv("BUILD_SHA", "abc1234");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cw_test_connection includes the build", async () => {
    const text = await callTestConnection();
    expect(text).toContain('"sha": "abc1234"');
    expect(JSON.parse(text).system).toEqual(SYSTEM_INFO);
  });

  it("healthPayload reports the build", () => {
    const payload = healthPayload("http") as {
      status: string;
      transport: string;
      build: { sha: string };
    };
    expect(payload.build.sha).toBe("abc1234");
    expect(payload.status).toBe("ok");
    expect(payload.transport).toBe("http");
  });
});

describe("build reporting when env is unset", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("unknown when unset", () => {
    vi.stubEnv("BUILD_SHA", undefined);
    vi.stubEnv("BUILD_DATE", undefined);
    vi.stubEnv("IMAGE_VERSION", undefined);
    const { build } = healthPayload("http") as {
      build: { sha: string; builtAt: string; image: string; version: string };
    };
    expect(build.sha).toBe("unknown");
    expect(build.builtAt).toBe("unknown");
    expect(build.image).toBe("unknown");
    expect(build.version).not.toBe("");
  });
});
