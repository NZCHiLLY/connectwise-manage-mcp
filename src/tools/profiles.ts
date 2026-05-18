import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * L1 helpdesk profile — exposes the ~55 tools most relevant to a
 * frontline support agent. Stays well under Copilot Studio's 70-tool cap.
 */
const L1_TOOLS = new Set([
  // ── Tickets ───────────────────────────────────────────────────────────────
  "cw_search_tickets",
  "cw_get_ticket",
  "cw_count_tickets",
  "cw_create_ticket",
  "cw_update_ticket",
  "cw_add_ticket_note",
  "cw_create_ticket_note",
  "cw_get_ticket_notes",
  "cw_list_ticket_notes",
  "cw_add_ticket_member",
  "cw_add_ticket_team_member",
  "cw_list_ticket_team",
  "cw_merge_tickets",
  "cw_list_ticket_configurations",
  "cw_list_ticket_time_entries",

  // ── Companies ─────────────────────────────────────────────────────────────
  "cw_search_companies",
  "cw_get_company",
  "cw_count_companies",
  "cw_list_company_sites",

  // ── Contacts ──────────────────────────────────────────────────────────────
  "cw_search_contacts",
  "cw_get_contact",
  "cw_count_contacts",
  "cw_create_contact",

  // ── Members ───────────────────────────────────────────────────────────────
  "cw_search_members",
  "cw_get_member",

  // ── Time entries ──────────────────────────────────────────────────────────
  "cw_search_time_entries",
  "cw_get_time_entry",
  "cw_create_time_entry",
  "cw_update_time_entry",

  // ── Service / boards & priorities ────────────────────────────────────────
  "cw_list_service_boards",
  "cw_list_service_priorities",

  // ── Configurations (assets) ───────────────────────────────────────────────
  "cw_search_configurations",
  "cw_get_configuration",

  // ── Agreements ────────────────────────────────────────────────────────────
  "cw_search_agreements",
  "cw_get_agreement",
  "cw_get_agreement_additions",

  // ── Projects ──────────────────────────────────────────────────────────────
  "cw_search_projects",
  "cw_get_project",
  "cw_list_project_tickets",

  // ── Schedule ──────────────────────────────────────────────────────────────
  "cw_create_schedule_entry",

  // ── Opportunities ─────────────────────────────────────────────────────────
  "cw_search_opportunities",
  "cw_get_opportunity",

  // ── Finance ───────────────────────────────────────────────────────────────
  "cw_search_invoices",
  "cw_get_invoice",

  // ── System / utility ──────────────────────────────────────────────────────
  "cw_test_connection",
]);

/**
 * Wraps an McpServer so that server.tool() calls whose name is not in the
 * allowlist are silently dropped. All other methods pass through unchanged.
 * This requires zero modifications to individual tool-registration files.
 */
export function applyToolProfile(
  server: McpServer,
  profile: string | undefined,
): McpServer {
  if (!profile || profile === "full") return server;

  const allowlist = profile === "l1" ? L1_TOOLS : null;
  if (!allowlist) {
    console.warn(`[mcp] Unknown MCP_TOOL_PROFILE "${profile}", using full tool set`);
    return server;
  }

  console.log(`[mcp] Tool profile "${profile}": exposing ${allowlist.size} tools`);

  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "tool") return Reflect.get(target, prop, receiver);
      return (name: string, ...rest: unknown[]) => {
        if (allowlist.has(name)) {
          return (target.tool as Function)(name, ...rest);
        }
      };
    },
  });
}
