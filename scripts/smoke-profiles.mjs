#!/usr/bin/env node
/**
 * Real-server profile smoke for the merge gate.
 *
 * Builds, starts dist/index.js in HTTP env mode on a free local port with dummy
 * ConnectWise credentials, then for each route sends initialize and tools/list
 * over JSON-RPC and prints the tool count. It also checks that a SENTINEL write
 * tool carries user_intent with minLength 20, and makes one invalid tools/call.
 *
 * Nothing here reaches ConnectWise successfully: the credentials are dummies and
 * the one tools/call is rejected by argument validation before any request.
 *
 * Usage: node scripts/smoke-profiles.mjs [--no-build]
 */
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:net";

const BEARER = "smoke-static-bearer";
const ROUTES = ["/mcp/l1", "/mcp/l2", "/mcp/l3", "/mcp", "/opportunities/mcp"];
const ACCEPT = "application/json, text/event-stream";

if (!process.argv.includes("--no-build")) {
  execSync("npm run build", { stdio: "inherit" });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/index.js"], {
  env: {
    ...process.env,
    MCP_TRANSPORT: "http",
    MCP_HTTP_HOST: "127.0.0.1",
    MCP_HTTP_PORT: String(port),
    AUTH_MODE: "env",
    CW_MANAGE_COMPANY_ID: "x",
    CW_MANAGE_PUBLIC_KEY: "x",
    CW_MANAGE_PRIVATE_KEY: "x",
    CW_MANAGE_CLIENT_ID: "x",
    CW_MANAGE_URL: "https://api-aus.myconnectwise.net",
    // The static bearer is only read when OAuth is enabled, which also needs
    // the Entra variables. These are dummies: the JWT path is never used.
    MCP_OAUTH_ENABLED: "true",
    AZURE_TENANT_ID: "00000000-0000-0000-0000-000000000000",
    AZURE_CLIENT_ID: "00000000-0000-0000-0000-000000000000",
    AZURE_AUDIENCE: "api://smoke",
    MCP_SERVER_URL: base,
    MCP_BEARER_TOKEN: BEARER,
  },
  stdio: ["ignore", "ignore", "pipe"],
});
let stderrTail = "";
child.stderr.on("data", (d) => {
  stderrTail = (stderrTail + d).slice(-4000);
});

async function rpc(route, method, params, id) {
  const res = await fetch(base + route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: ACCEPT,
      Authorization: `Bearer ${BEARER}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    const data = text.split("\n").find((l) => l.startsWith("data:"));
    body = data ? JSON.parse(data.slice(5)) : { raw: text };
  }
  return { status: res.status, body };
}

async function waitReady() {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${stderrTail}`);
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not become ready:\n${stderrTail}`);
}

let failed = false;
const fail = (msg) => {
  failed = true;
  console.log(`FAIL ${msg}`);
};

try {
  await waitReady();
  const init = {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "smoke-profiles", version: "1" },
  };
  const toolsByRoute = {};
  for (const route of ROUTES) {
    const i = await rpc(route, "initialize", init, 1);
    if (i.status !== 200 || !i.body.result) {
      fail(`${route} initialize: HTTP ${i.status} ${JSON.stringify(i.body)}`);
      continue;
    }
    const l = await rpc(route, "tools/list", {}, 2);
    const tools = l.body?.result?.tools;
    if (!Array.isArray(tools)) {
      fail(`${route} tools/list: HTTP ${l.status} ${JSON.stringify(l.body)}`);
      continue;
    }
    toolsByRoute[route] = tools;
    console.log(`route ${route.padEnd(20)} tools ${tools.length}`);
  }

  const full = toolsByRoute["/mcp"] ?? [];
  const sentinel = full.find((t) => t.inputSchema?.properties?.user_intent);
  if (!sentinel) {
    fail("no tool on /mcp carries user_intent");
  } else {
    const ui = sentinel.inputSchema.properties.user_intent;
    const ok = ui.minLength === 20;
    console.log(`sentinel ${sentinel.name} user_intent minLength ${ui.minLength}${ok ? "" : " (expected 20)"}`);
    if (!ok) failed = true;
  }

  const call = await rpc("/mcp", "tools/call", { name: "cw_get_ticket", arguments: { id: "abc" } }, 3);
  const errText = call.body?.error?.message ?? call.body?.result?.content?.[0]?.text;
  const isError = Boolean(call.body?.error) || call.body?.result?.isError === true;
  console.log(`invalid call cw_get_ticket id="abc": isError=${isError} text=${JSON.stringify(errText)}`);
  if (!isError) fail("invalid argument was not rejected");
} catch (err) {
  fail(String(err));
} finally {
  child.kill();
}
process.exit(failed ? 1 : 0);
