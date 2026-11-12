// Read-only route probe for the ConnectWise Manage REST API.
// GET only: there is no method parameter, so no other verb can be issued.
// Reads CW_MANAGE_* from the environment, prints only "<status> <path>" lines,
// the instance version and the note type route taken from ConnectWise's own reference.
// Never prints credentials or note bodies.

const API = "/v4_6_release/apis/3.0";

const { CW_MANAGE_URL, CW_MANAGE_COMPANY_ID, CW_MANAGE_PUBLIC_KEY, CW_MANAGE_PRIVATE_KEY, CW_MANAGE_CLIENT_ID } =
  process.env;
if (!CW_MANAGE_URL || !CW_MANAGE_COMPANY_ID || !CW_MANAGE_PUBLIC_KEY || !CW_MANAGE_PRIVATE_KEY || !CW_MANAGE_CLIENT_ID) {
  console.error("Set CW_MANAGE_URL, CW_MANAGE_COMPANY_ID, CW_MANAGE_PUBLIC_KEY, CW_MANAGE_PRIVATE_KEY, CW_MANAGE_CLIENT_ID.");
  process.exit(2);
}

const base = CW_MANAGE_URL.replace(/\/+$/, "");
const root = base.includes("/v4_6_release/") ? base : `${base}${API}`;
const apiPath = new URL(root).pathname.replace(/\/+$/, "");
const auth = `Basic ${Buffer.from(`${CW_MANAGE_COMPANY_ID}+${CW_MANAGE_PUBLIC_KEY}:${CW_MANAGE_PRIVATE_KEY}`).toString("base64")}`;

async function get(pathAndQuery) {
  const res = await fetch(`${root}${pathAndQuery}`, {
    method: "GET",
    headers: { Authorization: auth, clientId: CW_MANAGE_CLIENT_ID, Accept: "application/json" },
    redirect: "manual",
  });
  let json;
  if (res.ok) {
    try {
      json = await res.json();
    } catch {
      json = undefined;
    }
  } else {
    await res.body?.cancel();
  }
  return { status: res.status, json };
}

const candidates = [
  "/sales/opportunities/notes/types",
  "/sales/opportunities/noteTypes",
  "/company/noteTypes",
  "/sales/noteTypes",
  "/sales/quotes",
  "/sales/quotes/count",
  "/sales/orders",
  "/procurement/quotes",
  "/procurement/products?conditions=opportunity/id=2081",
  "/sales/opportunities/2081/products",
];

const info = await get("/system/info");
console.log(`instance version: ${info.status === 200 ? info.json?.version : `unavailable (${info.status})`}`);

for (const p of candidates) {
  const sep = p.includes("?") ? "&" : "?";
  const { status } = await get(`${p}${sep}pageSize=1`);
  console.log(`${status} ${p.split("?")[0]}${p.includes("?") ? "?" + p.split("?")[1] : ""}`);
}

// Note type route from ConnectWise's own reference on a real note.
const opps = await get("/sales/opportunities?pageSize=25&orderBy=id desc&fields=id");
const ids = opps.status === 200 && Array.isArray(opps.json) ? opps.json.map((o) => o.id) : [];
console.log(`opportunity list: ${opps.status}, ${ids.length} ids`);
let found = false;
for (const id of ids) {
  const n = await get(`/sales/opportunities/${id}/notes?pageSize=1`);
  const href = n.status === 200 && Array.isArray(n.json) ? n.json[0]?.type?._info?.type_href : undefined;
  const anyHref = href ?? (n.status === 200 && Array.isArray(n.json) ? Object.values(n.json[0]?.type?._info ?? {})[0] : undefined);
  if (anyHref) {
    let p = String(anyHref);
    try {
      p = new URL(p).pathname;
    } catch {
      // not an absolute URL, print as is
    }
    console.log(`note type href path (opportunity ${id}): ${p.startsWith(apiPath) ? p.slice(apiPath.length) : p}`);
    found = true;
    break;
  }
}
if (!found) console.log("note type href path: none found in the 25 newest opportunities");
