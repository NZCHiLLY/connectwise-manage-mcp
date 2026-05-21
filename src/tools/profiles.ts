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

// ── Domain profiles for multi-agent Copilot Studio expansion ─────────────────
// Each profile maps to one child agent at /<profile-key>/mcp
// Rules: no delete/remove operations, ≤40 tools (goal: 25), no marketing/projects

const TICKETS_TOOLS = new Set([
  "cw_search_tickets", "cw_get_ticket", "cw_get_ticket_by_id_search",
  "cw_create_ticket", "cw_update_ticket", "cw_replace_ticket",
  "cw_count_tickets", "cw_copy_ticket", "cw_merge_tickets",
  "cw_convert_ticket_from_survey",
  "cw_get_ticket_notes", "cw_get_ticket_note",
  "cw_add_ticket_note", "cw_update_ticket_note",
  "cw_list_ticket_tasks", "cw_get_ticket_task",
  "cw_create_ticket_task", "cw_update_ticket_task",
  "cw_list_ticket_team", "cw_get_ticket_team_member",
  "cw_add_ticket_team_member", "cw_update_ticket_team_member",
  "cw_add_ticket_member",
  "cw_list_ticket_products", "cw_list_ticket_configurations",
  "cw_attach_configuration_to_ticket",
  "cw_list_ticket_documents", "cw_list_ticket_time_entries",
  "cw_list_ticket_schedule_entries", "cw_list_ticket_activities",
]);

const SERVICE_BOARDS_TOOLS = new Set([
  "cw_list_service_boards", "cw_get_service_board",
  "cw_create_service_board", "cw_update_service_board",
  "cw_list_board_statuses", "cw_get_board_status",
  "cw_create_board_status", "cw_update_board_status",
  "cw_list_board_types", "cw_get_board_type",
  "cw_create_board_type", "cw_update_board_type",
  "cw_list_board_subtypes", "cw_get_board_subtype",
  "cw_create_board_subtype", "cw_update_board_subtype",
  "cw_list_board_items", "cw_get_board_item",
  "cw_create_board_item", "cw_update_board_item",
  "cw_list_board_teams", "cw_get_board_team",
  "cw_create_board_team", "cw_update_board_team",
]);

const SERVICE_CONFIG_TOOLS = new Set([
  "cw_list_service_priorities", "cw_get_service_priority",
  "cw_list_service_sources", "cw_get_service_source",
  "cw_list_slas", "cw_get_sla", "cw_list_sla_priorities",
  "cw_list_impacts", "cw_list_severities",
  "cw_list_ticket_templates", "cw_get_ticket_template",
  "cw_list_surveys", "cw_get_survey", "cw_list_survey_results",
  "cw_list_kb_articles", "cw_get_kb_article",
  "cw_list_service_categories", "cw_get_service_category",
  "cw_list_service_codes",
]);

const TIME_ENTRIES_TOOLS = new Set([
  "cw_search_time_entries", "cw_get_time_entry",
  "cw_count_time_entries", "cw_create_time_entry",
  "cw_update_time_entry", "cw_replace_time_entry", "cw_copy_time_entry",
  "cw_list_charge_codes", "cw_get_charge_code",
  "cw_create_charge_code", "cw_update_charge_code",
  "cw_list_charge_code_expense_types",
  "cw_list_work_types", "cw_get_work_type",
  "cw_create_work_type", "cw_update_work_type",
  "cw_create_work_role", "cw_update_work_role",
  "cw_list_time_sheets", "cw_get_time_sheet",
  "cw_submit_time_sheet", "cw_approve_time_sheet",
  "cw_reject_time_sheet", "cw_reverse_time_sheet",
  "cw_list_time_sheet_audits",
  "cw_list_time_accruals", "cw_get_time_accrual",
  "cw_list_time_periods", "cw_get_time_period",
  "cw_list_time_period_setups",
  "cw_list_stopwatches", "cw_get_stopwatch",
]);

const COMPANIES_TOOLS = new Set([
  "cw_search_companies", "cw_get_company",
  "cw_count_companies", "cw_create_company",
  "cw_update_company", "cw_replace_company",
  "cw_list_company_sites", "cw_get_company_site",
  "cw_create_company_site", "cw_update_company_site",
  "cw_list_company_notes", "cw_get_company_note",
  "cw_create_company_note", "cw_update_company_note",
  "cw_list_company_teams", "cw_get_company_team",
  "cw_create_company_team", "cw_update_company_team",
  "cw_list_company_custom_fields", "cw_list_company_management_summary",
  "cw_list_company_statuses", "cw_get_company_status",
  "cw_create_company_status", "cw_update_company_status",
  "cw_list_company_types", "cw_get_company_type",
  "cw_create_company_type", "cw_update_company_type",
  "cw_list_team_roles", "cw_get_team_role",
  "cw_list_company_markets", "cw_list_company_ownership_types",
]);

const CONTACTS_TOOLS = new Set([
  "cw_search_contacts", "cw_get_contact",
  "cw_count_contacts", "cw_create_contact",
  "cw_update_contact", "cw_replace_contact",
  "cw_list_contact_communications", "cw_get_contact_communication",
  "cw_create_contact_communication", "cw_update_contact_communication",
  "cw_list_contact_notes", "cw_get_contact_note",
  "cw_create_contact_note", "cw_update_contact_note",
  "cw_list_contact_tracks", "cw_add_contact_track",
  "cw_list_contact_types", "cw_get_contact_type",
  "cw_create_contact_type", "cw_update_contact_type",
  "cw_list_contact_departments", "cw_get_contact_department",
  "cw_list_contact_relationships",
  "cw_list_communication_types",
  "cw_list_portal_security_levels",
  "cw_list_contact_tracks_catalog",
]);

const CONFIGURATIONS_TOOLS = new Set([
  "cw_search_configurations", "cw_get_configuration",
  "cw_create_configuration", "cw_update_configuration",
  "cw_bulk_update_configurations",
  "cw_list_configuration_questions", "cw_get_configuration_question",
  "cw_update_configuration_question",
  "cw_list_configuration_types", "cw_get_configuration_type",
  "cw_create_configuration_type", "cw_update_configuration_type",
  "cw_list_configuration_type_questions", "cw_get_configuration_type_question",
  "cw_create_configuration_type_question", "cw_update_configuration_type_question",
  "cw_list_configuration_type_question_values",
  "cw_create_configuration_type_question_value",
  "cw_update_configuration_type_question_value",
  "cw_list_configuration_statuses", "cw_get_configuration_status",
  "cw_create_configuration_status", "cw_update_configuration_status",
]);

const SALES_TOOLS = new Set([
  "cw_list_sales_forecast", "cw_get_sales_forecast",
  "cw_search_quotes", "cw_get_quote", "cw_count_quotes",
  "cw_create_quote", "cw_update_quote", "cw_replace_quote",
  "cw_list_sales_probabilities", "cw_get_sales_probability",
  "cw_create_sales_probability", "cw_update_sales_probability",
  "cw_list_opportunity_statuses", "cw_get_opportunity_status",
  "cw_create_opportunity_status", "cw_update_opportunity_status",
  "cw_list_opportunity_types", "cw_get_opportunity_type",
  "cw_create_opportunity_type", "cw_update_opportunity_type",
  "cw_list_opportunity_rating_types", "cw_get_opportunity_rating_type",
  "cw_list_sales_stages", "cw_get_sales_stage",
  "cw_create_sales_stage", "cw_update_sales_stage",
  "cw_list_sales_territories", "cw_get_sales_territory",
  "cw_create_sales_territory", "cw_update_sales_territory",
  "cw_list_sales_teams", "cw_get_sales_team",
  "cw_list_sales_order_statuses", "cw_get_sales_order_status",
]);

const OPPORTUNITIES_TOOLS = new Set([
  // Opportunities
  "cw_search_opportunities", "cw_get_opportunity",
  "cw_count_opportunities", "cw_create_opportunity",
  "cw_update_opportunity", "cw_copy_opportunity",
  "cw_win_opportunity", "cw_lose_opportunity", "cw_reopen_opportunity",
  "cw_convert_opportunity_to_project", "cw_convert_opportunity_to_ticket",
  "cw_list_opportunity_products", "cw_get_opportunity_product",
  "cw_create_opportunity_product", "cw_update_opportunity_product",
  "cw_list_opportunity_contacts", "cw_add_opportunity_contact",
  "cw_list_opportunity_notes", "cw_get_opportunity_note",
  "cw_create_opportunity_note", "cw_update_opportunity_note",
  "cw_list_opportunity_ratings", "cw_get_opportunity_rating",
  "cw_list_opportunity_note_types",
  // Activities
  "cw_search_activities", "cw_get_activity",
  "cw_count_activities", "cw_create_activity",
  "cw_update_activity", "cw_replace_activity",
  "cw_list_activity_types", "cw_get_activity_type",
  "cw_create_activity_type", "cw_update_activity_type",
  "cw_list_activity_statuses", "cw_get_activity_status",
  "cw_create_activity_status", "cw_update_activity_status",
]);

const FINANCE_AGREEMENTS_TOOLS = new Set([
  "cw_search_agreements", "cw_get_agreement",
  "cw_create_agreement", "cw_update_agreement",
  "cw_cancel_agreement", "cw_copy_agreement",
  "cw_get_agreement_additions", "cw_get_agreement_addition",
  "cw_create_agreement_addition", "cw_update_agreement_addition",
  "cw_list_agreement_workroles", "cw_get_agreement_workrole",
  "cw_create_agreement_workrole", "cw_update_agreement_workrole",
  "cw_list_agreement_worktypes",
  "cw_list_agreement_sites", "cw_list_agreement_configurations",
  "cw_list_agreement_boards",
  "cw_list_agreement_types", "cw_get_agreement_type",
  "cw_list_work_roles", "cw_get_work_role",
  "cw_list_billing_cycles", "cw_list_billing_terms",
  "cw_list_billing_statuses",
  "cw_list_gl_accounts", "cw_list_gl_types", "cw_list_gl_payment_types",
  "cw_list_tax_codes", "cw_get_tax_code",
]);

const FINANCE_INVOICES_TOOLS = new Set([
  "cw_search_invoices", "cw_get_invoice",
  "cw_update_invoice", "cw_email_invoice", "cw_pay_invoice",
  "cw_search_payments", "cw_get_payment",
  "cw_list_billing_setups",
  "cw_list_invoice_templates", "cw_list_delivery_methods",
  "cw_list_accounting_batches", "cw_get_accounting_batch",
  "cw_list_currencies",
]);

const CATALOG_TOOLS = new Set([
  "cw_search_catalog_items", "cw_get_catalog_item",
  "cw_count_catalog_items", "cw_create_catalog_item",
  "cw_update_catalog_item", "cw_replace_catalog_item", "cw_copy_catalog_item",
  "cw_list_catalog_components", "cw_get_catalog_component",
  "cw_create_catalog_component", "cw_update_catalog_component",
  "cw_list_catalog_bundled_items", "cw_get_catalog_bundled_item",
  "cw_create_catalog_bundled_item", "cw_update_catalog_bundled_item",
  "cw_get_catalog_inventory_on_hand",
  "cw_list_catalog_pricing", "cw_get_catalog_pricing",
  "cw_create_catalog_pricing", "cw_update_catalog_pricing",
  "cw_list_catalog_item_types", "cw_get_catalog_item_type",
  "cw_list_catalog_sub_categories", "cw_get_catalog_sub_category",
  "cw_list_catalog_manufacturer_parts", "cw_create_catalog_manufacturer_part",
  "cw_list_catalog_categories", "cw_list_catalog_subcategories",
]);

const PROCUREMENT_ORDERS_TOOLS = new Set([
  "cw_search_products", "cw_get_product",
  "cw_create_product", "cw_update_product",
  "cw_list_product_components",
  "cw_get_product_picking_shipping_detail",
  "cw_list_product_picking_shipping_details",
  "cw_search_purchase_orders", "cw_get_purchase_order",
  "cw_create_purchase_order", "cw_update_purchase_order",
  "cw_submit_purchase_order", "cw_unsubmit_purchase_order",
  "cw_email_purchase_order",
  "cw_list_purchase_order_line_items", "cw_get_purchase_order_line_item",
  "cw_create_purchase_order_line_item", "cw_update_purchase_order_line_item",
  "cw_list_purchase_order_statuses", "cw_get_purchase_order_status",
  "cw_list_rma_actions", "cw_list_rma_dispositions", "cw_list_rma_statuses",
  "cw_list_product_categories", "cw_list_product_sub_categories",
  "cw_list_product_types",
  "cw_list_shipment_methods", "cw_get_shipment_method",
]);

const PROCUREMENT_INVENTORY_TOOLS = new Set([
  "cw_list_warehouses", "cw_get_warehouse",
  "cw_create_warehouse", "cw_update_warehouse",
  "cw_list_warehouse_bins", "cw_get_warehouse_bin",
  "cw_create_warehouse_bin", "cw_update_warehouse_bin",
  "cw_list_pricing_schedules", "cw_get_pricing_schedule",
  "cw_create_pricing_schedule", "cw_update_pricing_schedule",
  "cw_list_pricing_schedule_details",
  "cw_list_adjustments", "cw_get_adjustment",
  "cw_create_adjustment", "cw_update_adjustment",
  "cw_list_adjustment_details", "cw_create_adjustment_detail",
  "cw_list_adjustment_types", "cw_get_adjustment_type",
  "cw_list_unit_of_measures", "cw_get_unit_of_measure",
  "cw_list_manufacturers",
]);

const SYSTEM_MEMBERS_TOOLS = new Set([
  "cw_search_members", "cw_get_member",
  "cw_create_member", "cw_update_member",
  "cw_deactivate_member", "cw_get_member_image",
  "cw_list_member_skills", "cw_add_member_skill",
  "cw_list_member_notifications",
  "cw_search_api_members", "cw_get_api_member",
  "cw_list_api_member_keys", "cw_create_api_member_key",
  "cw_list_security_roles", "cw_get_security_role",
  "cw_list_security_role_permissions", "cw_list_security_role_settings",
  "cw_list_departments", "cw_get_department",
  "cw_list_locations", "cw_get_location",
  "cw_get_my_company", "cw_get_my_account",
]);

const SYSTEM_ADMIN_TOOLS = new Set([
  "cw_list_audit_trail",
  "cw_list_callbacks", "cw_get_callback",
  "cw_create_callback", "cw_update_callback",
  "cw_list_user_defined_fields", "cw_get_user_defined_field",
  "cw_list_reports", "cw_get_report", "cw_run_report",
  "cw_list_integrator_logins", "cw_get_integrator_login",
  "cw_list_menu_entries",
  "cw_list_workflows", "cw_get_workflow",
  "cw_list_documents", "cw_get_document",
  "cw_list_in_out_board", "cw_list_in_out_types",
  "cw_list_kpis", "cw_get_kpi",
  "cw_list_notification_recipients",
  "cw_list_links", "cw_get_link",
  "cw_get_system_info",
]);

const SCHEDULE_EXPENSES_TOOLS = new Set([
  // Schedule
  "cw_search_schedule_entries", "cw_get_schedule_entry",
  "cw_create_schedule_entry", "cw_update_schedule_entry",
  "cw_list_schedule_types", "cw_get_schedule_type",
  "cw_list_schedule_statuses", "cw_get_schedule_status",
  "cw_list_holiday_lists", "cw_get_holiday_list", "cw_list_holidays",
  "cw_list_calendars", "cw_get_calendar", "cw_copy_calendar",
  "cw_list_schedule_colors",
  "cw_list_portal_calendars", "cw_get_portal_calendar",
  "cw_list_schedule_details",
  // Expenses
  "cw_search_expense_entries", "cw_get_expense_entry",
  "cw_create_expense_entry", "cw_update_expense_entry",
  "cw_search_expense_reports", "cw_get_expense_report",
  "cw_create_expense_report", "cw_update_expense_report",
  "cw_approve_expense_report", "cw_reject_expense_report",
  "cw_submit_expense_report", "cw_list_expense_report_entries",
  "cw_list_expense_classifications", "cw_get_expense_classification",
  "cw_list_expense_types", "cw_get_expense_type",
  "cw_create_expense_type", "cw_update_expense_type",
]);

const DOMAIN_PROFILES: Record<string, Set<string>> = {
  "tickets":                TICKETS_TOOLS,
  "service-boards":         SERVICE_BOARDS_TOOLS,
  "service-config":         SERVICE_CONFIG_TOOLS,
  "time-entries":           TIME_ENTRIES_TOOLS,
  "companies":              COMPANIES_TOOLS,
  "contacts":               CONTACTS_TOOLS,
  "configurations":         CONFIGURATIONS_TOOLS,
  "sales":                  SALES_TOOLS,
  "opportunities":          OPPORTUNITIES_TOOLS,
  "finance-agreements":     FINANCE_AGREEMENTS_TOOLS,
  "finance-invoices":       FINANCE_INVOICES_TOOLS,
  "catalog":                CATALOG_TOOLS,
  "procurement-orders":     PROCUREMENT_ORDERS_TOOLS,
  "procurement-inventory":  PROCUREMENT_INVENTORY_TOOLS,
  "system-members":         SYSTEM_MEMBERS_TOOLS,
  "system-admin":           SYSTEM_ADMIN_TOOLS,
  "schedule-expenses":      SCHEDULE_EXPENSES_TOOLS,
};

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
    profile && DOMAIN_PROFILES[profile] !== undefined ? DOMAIN_PROFILES[profile] :
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
