import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { getBuildInfo } from "../build-info.js";

export function registerHealthTools(server: McpServer, client: CwManageClient) {
  server.tool(
    "cw_test_connection",
    "Test the connection to ConnectWise Manage by fetching system info. Returns API version and licensing details, plus the build of this server (commit, build date, version, image tag).",
    {},
    async () => {
      const system = await client.get("/system/info");
      return {
        content: [{ type: "text", text: JSON.stringify({ build: getBuildInfo(), system }, null, 2) }],
      };
    },
  );
}
