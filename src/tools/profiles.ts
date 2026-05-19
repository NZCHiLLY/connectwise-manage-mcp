import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { auditOutcome } from "../audit/log.js";

/**
 * L1 helpdesk engineer profile — deep ticket management plus supporting
 * lookups. Capped at 70 tools for Copilot Studio compatibility.
 */
const L1_TOOLS = new Set([
  // ── Tickets (full lifecycle) ──────────────────────────────────────────────
  "cw_search_tickets",
  "cw_get_ticket",
  "cw_get_ticket_by_id_search",
  "cw_count_tickets",
  "cw_create_ticket",
  "cw_update_ticket",
  "cw_delete_ticket",
  "cw_copy_ticket",
  "cw_replace_ticket",
  "cw_merge_tickets",

  // ── Ticket notes ─────────────────────────────────────────────────────────
  "cw_add_ticket_note",
  "cw_get_ticket_note",
  "cw_get_ticket_notes",
  "cw_update_ticket_note",
  "cw_delete_ticket_note",

  // ── Ticket team / members ─────────────────────────────────────────────────
  "cw_add_ticket_member",
  "cw_add_ticket_team_member",
  "cw_list_ticket_team",
  "cw_get_ticket_team_member",
  "cw_update_ticket_team_member",
  "cw_remove_ticket_team_member",

  // ── Ticket tasks ─────────────────────────────────────────────────────────
  "cw_create_ticket_task",
  "cw_get_ticket_task",
  "cw_list_ticket_tasks",
  "cw_update_ticket_task",
  "cw_delete_ticket_task",

  // ── Ticket related lists ─────────────────────────────────────────────────
  "cw_list_ticket_configurations",
  "cw_attach_configuration_to_ticket",
  "cw_detach_configuration_from_ticket",
  "cw_list_ticket_time_entries",
  "cw_list_ticket_activities",
  "cw_list_ticket_documents",
  "cw_list_ticket_products",
  "cw_list_ticket_schedule_entries",

  // ── Companies (lookup) ────────────────────────────────────────────────────
  "cw_search_companies",
  "cw_get_company",
  "cw_count_companies",
  "cw_list_company_sites",

  // ── Contacts (lookup + create) ────────────────────────────────────────────
  "cw_search_contacts",
  "cw_get_contact",
  "cw_count_contacts",
  "cw_create_contact",

  // ── Members (lookup) ─────────────────────────────────────────────────────
  "cw_search_members",
  "cw_get_member",

  // ── Time entries (create + update for ticket work) ────────────────────────
  "cw_search_time_entries",
  "cw_get_time_entry",
  "cw_create_time_entry",
  "cw_update_time_entry",

  // ── Service / board metadata (valid values for ticket fields) ─────────────
  "cw_list_service_boards",
  "cw_get_service_board",
  "cw_list_service_priorities",
  "cw_get_service_priority",
  "cw_list_board_statuses",
  "cw_list_board_types",
  "cw_list_board_subtypes",
  "cw_list_board_items",
  "cw_list_board_teams",
  "cw_list_service_categories",
  "cw_list_service_sources",
  "cw_list_impacts",
  "cw_list_severities",

  // ── Configurations (assets) ───────────────────────────────────────────────
  "cw_search_configurations",
  "cw_get_configuration",

  // ── Schedule ──────────────────────────────────────────────────────────────
  "cw_create_schedule_entry",

  // ── System / utility ──────────────────────────────────────────────────────
  "cw_test_connection",
]);

/**
 * L2 management profile — operational oversight across tickets, projects,
 * time, assets, finance, and reporting. Capped at 70 tools.
 */
const L2_TOOLS = new Set([
  // ── Tickets (escalation + oversight) ─────────────────────────────────────
  "cw_search_tickets",
  "cw_get_ticket",
  "cw_count_tickets",
  "cw_create_ticket",
  "cw_update_ticket",
  "cw_merge_tickets",
  "cw_add_ticket_note",
  "cw_get_ticket_notes",
  "cw_list_ticket_team",
  "cw_add_ticket_member",
  "cw_list_ticket_time_entries",
  "cw_list_ticket_configurations",

  // ── Projects (oversight + management) ────────────────────────────────────
  "cw_search_projects",
  "cw_get_project",
  "cw_count_projects",
  "cw_create_project",
  "cw_update_project",
  "cw_list_project_tickets",
  "cw_list_project_phases",
  "cw_list_project_team_members",
  "cw_list_project_statuses",
  "cw_list_project_boards",

  // ── Time / resource visibility ────────────────────────────────────────────
  "cw_search_time_entries",
  "cw_get_time_entry",
  "cw_count_time_entries",
  "cw_create_time_entry",
  "cw_update_time_entry",
  "cw_list_time_sheets",
  "cw_get_time_sheet",

  // ── Financial oversight (read-heavy) ──────────────────────────────────────
  "cw_search_agreements",
  "cw_get_agreement",
  "cw_get_agreement_additions",
  "cw_list_agreement_configurations",
  "cw_list_agreement_types",
  "cw_search_invoices",
  "cw_get_invoice",
  "cw_search_payments",
  "cw_list_work_roles",

  // ── Configurations / assets ───────────────────────────────────────────────
  "cw_search_configurations",
  "cw_get_configuration",
  "cw_list_configuration_types",
  "cw_get_configuration_type",

  // ── Opportunities (pipeline visibility) ───────────────────────────────────
  "cw_search_opportunities",
  "cw_get_opportunity",
  "cw_count_opportunities",
  "cw_list_opportunity_statuses",

  // ── Companies / contacts (lookup) ─────────────────────────────────────────
  "cw_search_companies",
  "cw_get_company",
  "cw_count_companies",
  "cw_search_contacts",
  "cw_get_contact",
  "cw_count_contacts",

  // ── Members / team ────────────────────────────────────────────────────────
  "cw_search_members",
  "cw_get_member",
  "cw_get_my_account",
  "cw_get_my_company",
  "cw_list_departments",

  // ── Reporting / KPIs / audit ──────────────────────────────────────────────
  "cw_list_reports",
  "cw_run_report",
  "cw_get_report",
  "cw_list_kpis",
  "cw_get_kpi",
  "cw_list_audit_trail",

  // ── Schedule ──────────────────────────────────────────────────────────────
  "cw_create_schedule_entry",
  "cw_search_schedule_entries",

  // ── Service metadata ──────────────────────────────────────────────────────
  "cw_list_service_boards",
  "cw_list_service_priorities",
  "cw_list_board_statuses",
  "cw_list_impacts",

  // ── System / utility ──────────────────────────────────────────────────────
  "cw_test_connection",
]);

/**
 * Maps an Azure AD app role to a tool profile name.
 * CWM.L1  → "l1"  (helpdesk engineer, 65 ticket-focused tools)
 * CWM.L2  → "l2"  (management, 70 operational-oversight tools)
 * Unrecognised roles fall through to the MCP_TOOL_PROFILE env var.
 */
const ROLE_PROFILE_MAP: Record<string, string> = {
  "CWM.L1": "l1",
  "CWM.L2": "l2",
};

/**
 * Returns the tool profile for the first matching role, or undefined if none
 * of the caller's roles appear in ROLE_PROFILE_MAP.
 */
export function profileFromRoles(roles: string[]): string | undefined {
  for (const role of roles) {
    const profile = ROLE_PROFILE_MAP[role];
    if (profile !== undefined) return profile;
  }
  return undefined;
}

/**
 * Wraps the tool handler to catch errors and return structured MCP error
 * responses (isError: true) instead of throwing. Also records failure
 * outcomes in the audit log.
 */
function wrapHandler(
  toolName: string,
  handler: (...args: unknown[]) => Promise<unknown>,
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]) => {
    try {
      const result = await handler(...args);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[tool:${toolName}] error: ${msg}`);
      void auditOutcome(toolName, "failure", msg);
      return {
        content: [{ type: "text", text: `${toolName} failed: ${msg}` }],
        isError: true,
      };
    }
  };
}

/**
 * Wraps the Zod input schema to log the raw arg blob on parse failure.
 * Re-throws so the SDK still returns a standard validation error to the client.
 */
function wrapSchema(toolName: string, schema: unknown): unknown {
  return new Proxy(schema as object, {
    get(target, prop, receiver) {
      if (prop !== "parseAsync") return Reflect.get(target, prop, receiver);
      const original = Reflect.get(target, prop, receiver) as (args: unknown) => Promise<unknown>;
      return async (args: unknown) => {
        try {
          return await original.call(target, args);
        } catch (err) {
          let preview = "(non-serialisable)";
          try { preview = JSON.stringify(args)?.slice(0, 500) ?? preview; } catch { /* */ }
          console.error(`[tool:${toolName}] parse failure | ${preview}`);
          throw err;
        }
      };
    },
  });
}

/**
 * Wraps an McpServer so that:
 *   - tools not in the profile allowlist are silently dropped
 *   - all tool handlers return structured isError responses instead of throwing
 *   - parse failures log the raw arg blob (first 500 chars) with the tool name
 *   - handler failures are recorded as outcome entries in the audit log
 *
 * The proxy is always applied (even for "full" profile) so observability
 * improvements cover all profiles. Profile filtering is a no-op when
 * allowlist is undefined (full/unset).
 */
export function applyToolProfile(
  server: McpServer,
  profile: string | undefined,
): McpServer {
  const allowlist =
    profile === "l1" ? L1_TOOLS :
    profile === "l2" ? L2_TOOLS :
    profile && profile !== "full" ? null :  // unknown profile → warn, allow all
    undefined;                              // full or unset → no filtering

  if (allowlist === null) {
    console.warn(`[mcp] Unknown MCP_TOOL_PROFILE "${profile}", using full tool set`);
  } else if (allowlist !== undefined) {
    console.log(`[mcp] Tool profile "${profile}": exposing ${allowlist.size} tools`);
  }

  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "tool") return Reflect.get(target, prop, receiver);
      return (name: string, ...rest: unknown[]) => {
        if (allowlist && !allowlist.has(name)) return;

        const wrappedRest = [...rest];

        // Wrap handler (always last arg) for isError responses + audit outcomes
        const handlerIdx = wrappedRest.length - 1;
        if (typeof wrappedRest[handlerIdx] === "function") {
          wrappedRest[handlerIdx] = wrapHandler(
            name,
            wrappedRest[handlerIdx] as (...a: unknown[]) => Promise<unknown>,
          );
        }

        // Wrap schema (second-to-last arg) for parse failure logging
        const schemaIdx = wrappedRest.length - 2;
        if (schemaIdx >= 0) {
          const maybeSchema = wrappedRest[schemaIdx];
          if (maybeSchema !== null && typeof maybeSchema === "object" && "parseAsync" in (maybeSchema as object)) {
            wrappedRest[schemaIdx] = wrapSchema(name, maybeSchema);
          }
        }

        return (target.tool as (name: string, ...args: unknown[]) => unknown)(name, ...wrappedRest);
      };
    },
  });
}
