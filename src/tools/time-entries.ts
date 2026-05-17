import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerTimeEntryTools(server: McpServer, client: CwManageClient) {
  // ── Time entries ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_search_time_entries",
    "Search time entries. Use 'conditions' for CW query syntax.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Child object conditions query string"),
      customFieldConditions: z.string().optional().describe("Custom field conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    },
    async ({ conditions, childConditions, customFieldConditions, page, pageSize, orderBy, fields }) => {
      const result = await client.get("/time/entries", {
        conditions,
        childConditions,
        customFieldConditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
        fields,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_time_entry",
    "Get a single time entry.",
    {
      id: z.number().describe("Time entry ID"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/time/entries/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_time_entries",
    "Count time entries matching a conditions query.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Child object conditions query string"),
      customFieldConditions: z.string().optional().describe("Custom field conditions query string"),
    },
    async (args) => {
      const result = await client.get("/time/entries/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_time_entry",
    "Create a time entry. chargeToId and chargeToType are required. " +
      "chargeToType is one of: ServiceTicket | ProjectTicket | ChargeCode | Activity.",
    {
      chargeToId: z.number().describe("Ticket / project ticket / charge code / activity ID"),
      chargeToType: z.enum(["ServiceTicket", "ProjectTicket", "ChargeCode", "Activity"]),
      memberId: z.number().optional().describe("Member ID (defaults to current API member)"),
      workTypeId: z.number().optional().describe("Work type ID"),
      workRoleId: z.number().optional().describe("Work role ID"),
      agreementId: z.number().optional().describe("Agreement ID to charge against"),
      timeStart: z.string().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      timeEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      hoursDeduct: z.number().optional().describe("Hours to deduct from the agreement"),
      actualHours: z.number().optional().describe("Hours actually worked"),
      billableOption: z.enum(["Billable", "DoNotBill", "NoCharge", "NoDefault"]).optional(),
      notes: z.string().optional().describe("Public time-entry notes"),
      internalNotes: z.string().optional().describe("Internal-only notes"),
      addToDetailDescriptionFlag: z.boolean().optional().describe("Append notes to ticket detail description"),
      addToInternalAnalysisFlag: z.boolean().optional().describe("Append notes to internal analysis"),
      addToResolutionFlag: z.boolean().optional().describe("Append notes to resolution field"),
      emailResourceFlag: z.boolean().optional().describe("Email the assigned resource when saving"),
      emailContactFlag: z.boolean().optional().describe("Email the contact when saving"),
      emailCcFlag: z.boolean().optional().describe("Email the CC address when saving"),
      emailCc: z.string().optional().describe("CC email address"),
      hoursBilled: z.number().optional().describe("Hours billed (override)"),
      enteredBy: z.string().optional().describe("Member identifier who entered the time"),
      dateEntered: z.string().optional().describe("Date the time was entered (ISO 8601)"),
      invoiceId: z.number().optional().describe("Invoice ID if already invoiced"),
      mobileGuid: z.string().optional().describe("Mobile GUID"),
      hourlyRate: z.number().optional().describe("Hourly rate override"),
      overageRate: z.number().optional().describe("Overage rate"),
      agreementHours: z.number().optional().describe("Agreement hours"),
      agreementAmount: z.number().optional().describe("Agreement amount"),
      timeSheetId: z.number().optional().describe("Time sheet ID"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      status: z.enum(["Open", "Billed", "Closed"]).optional(),
      ticketBoardId: z.number().optional().describe("Service board ID for the associated ticket"),
      ticketStatusId: z.number().optional().describe("Status ID to set on the ticket after saving"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        chargeToId: args.chargeToId,
        chargeToType: args.chargeToType,
        timeStart: args.timeStart,
      };
      if (args.memberId !== undefined) body.member = { id: args.memberId };
      if (args.workTypeId !== undefined) body.workType = { id: args.workTypeId };
      if (args.workRoleId !== undefined) body.workRole = { id: args.workRoleId };
      if (args.agreementId !== undefined) body.agreement = { id: args.agreementId };
      if (args.timeEnd) body.timeEnd = args.timeEnd;
      if (args.hoursDeduct !== undefined) body.hoursDeduct = args.hoursDeduct;
      if (args.actualHours !== undefined) body.actualHours = args.actualHours;
      if (args.billableOption) body.billableOption = args.billableOption;
      if (args.notes) body.notes = args.notes;
      if (args.internalNotes) body.internalNotes = args.internalNotes;
      if (args.addToDetailDescriptionFlag !== undefined) body.addToDetailDescriptionFlag = args.addToDetailDescriptionFlag;
      if (args.addToInternalAnalysisFlag !== undefined) body.addToInternalAnalysisFlag = args.addToInternalAnalysisFlag;
      if (args.addToResolutionFlag !== undefined) body.addToResolutionFlag = args.addToResolutionFlag;
      if (args.emailResourceFlag !== undefined) body.emailResourceFlag = args.emailResourceFlag;
      if (args.emailContactFlag !== undefined) body.emailContactFlag = args.emailContactFlag;
      if (args.emailCcFlag !== undefined) body.emailCcFlag = args.emailCcFlag;
      if (args.emailCc) body.emailCc = args.emailCc;
      if (args.hoursBilled !== undefined) body.hoursBilled = args.hoursBilled;
      if (args.enteredBy) body.enteredBy = args.enteredBy;
      if (args.dateEntered) body.dateEntered = args.dateEntered;
      if (args.invoiceId !== undefined) body.invoice = { id: args.invoiceId };
      if (args.mobileGuid) body.mobileGuid = args.mobileGuid;
      if (args.hourlyRate !== undefined) body.hourlyRate = args.hourlyRate;
      if (args.overageRate !== undefined) body.overageRate = args.overageRate;
      if (args.agreementHours !== undefined) body.agreementHours = args.agreementHours;
      if (args.agreementAmount !== undefined) body.agreementAmount = args.agreementAmount;
      if (args.timeSheetId !== undefined) body.timeSheet = { id: args.timeSheetId };
      if (args.locationId !== undefined) body.location = { id: args.locationId };
      if (args.businessUnitId !== undefined) body.businessUnit = { id: args.businessUnitId };
      if (args.status) body.status = args.status;
      if (args.ticketBoardId !== undefined) body.ticket = { ...(body.ticket as Record<string, unknown> | undefined ?? {}), board: { id: args.ticketBoardId } };
      if (args.ticketStatusId !== undefined) body.ticket = { ...(body.ticket as Record<string, unknown> | undefined ?? {}), status: { id: args.ticketStatusId } };
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/time/entries", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_time_entry",
    "Update a time entry via JSON Patch.",
    {
      id: z.number().describe("Time entry ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/time/entries/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_time_entry",
    "Replace a time entry via PUT.",
    {
      id: z.number().describe("Time entry ID"),
      body: z.record(z.string(), z.unknown()).describe("Full replacement body for PUT"),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/time/entries/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_time_entry",
    "Delete a time entry. Destructive.",
    {
      id: z.number().describe("Time entry ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/time/entries/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_time_entry",
    "Copy a time entry to a new entry via /time/entries/{id}/copy.",
    {
      id: z.number().describe("Time entry ID to copy"),
      memberId: z.number().optional().describe("Override member on the copy"),
      timeStart: z.string().optional().describe("Start date/time (ISO 8601, e.g. 2024-01-15T09:00:00Z)"),
      timeEnd: z.string().optional().describe("End date/time (ISO 8601, e.g. 2024-01-15T17:00:00Z)"),
    },
    async (args) => {
      const body: Record<string, unknown> = {};
      if (args.memberId !== undefined) body.member = { id: args.memberId };
      if (args.timeStart) body.timeStart = args.timeStart;
      if (args.timeEnd) body.timeEnd = args.timeEnd;
      const result = await client.post(`/time/entries/${args.id}/copy`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Charge codes ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_charge_codes",
    "List time-entry charge codes (non-ticket time buckets).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/time/chargeCodes", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_charge_code",
    "Get a charge code.",
    {
      id: z.number().describe("Charge code ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/chargeCodes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_charge_code",
    "Create a charge code.",
    {
      name: z.string().describe("Charge code name"),
      typeId: z.number().optional().describe("Charge code type ID"),
      classification: z.string().optional().describe("B (Billable) | NB (Non-billable) | NC (No-charge)"),
      integrationXref: z.string().optional().describe("External system cross-reference identifier"),
      allowAllExpenseFlag: z.boolean().optional().describe("Allow all expense types on this charge code"),
      expenseEntryFlag: z.boolean().optional().describe("Allow expense entries"),
      timeEntryFlag: z.boolean().optional().describe("Allow time entries"),
      activityTypeId: z.number().optional().describe("Activity type ID"),
      defaultStatusId: z.number().optional().describe("Default status ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      locationId: z.number().optional().describe("Location ID"),
      departmentId: z.number().optional().describe("Department ID"),
      payrollItemId: z.number().optional().describe("Payroll item ID"),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.classification) body.classification = { classification: args.classification };
      if (args.integrationXref) body.integrationXref = args.integrationXref;
      if (args.allowAllExpenseFlag !== undefined) body.allowAllExpenseFlag = args.allowAllExpenseFlag;
      if (args.expenseEntryFlag !== undefined) body.expenseEntryFlag = args.expenseEntryFlag;
      if (args.timeEntryFlag !== undefined) body.timeEntryFlag = args.timeEntryFlag;
      if (args.activityTypeId !== undefined) body.activityType = { id: args.activityTypeId };
      if (args.defaultStatusId !== undefined) body.defaultStatus = { id: args.defaultStatusId };
      if (args.businessUnitId !== undefined) body.businessUnit = { id: args.businessUnitId };
      if (args.locationId !== undefined) body.location = { id: args.locationId };
      if (args.departmentId !== undefined) body.department = { id: args.departmentId };
      if (args.payrollItemId !== undefined) body.payrollItem = { id: args.payrollItemId };
      const result = await client.post("/time/chargeCodes", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_charge_code",
    "Update a charge code via JSON Patch.",
    {
      id: z.number().describe("Charge code ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/time/chargeCodes/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_charge_code",
    "Delete a charge code.",
    {
      id: z.number().describe("Charge code ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/time/chargeCodes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Charge code expense types ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_charge_code_expense_types",
    "List expense types allowed under a charge code.",
    {
      chargeCodeId: z.number().describe("Charge code ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ chargeCodeId, conditions, page, pageSize }) => {
      const result = await client.get(`/time/chargeCodes/${chargeCodeId}/expenseTypes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Work types ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_work_types",
    "List work types (e.g. Remote, Onsite).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/time/workTypes", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_work_type",
    "Get a work type.",
    {
      id: z.number().describe("Work type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/workTypes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_work_type",
    "Create a work type.",
    {
      name: z.string().describe("Work type name"),
      billTime: z.string().optional().describe("Billable | DoNotBill | NoCharge | NoDefault"),
      rateType: z.string().optional().describe("AdjustedByMultiplier | Multiplier | Flat"),
      hoursMultiplier: z.number().optional().describe("Billing hours multiplier"),
      overallDefaultFlag: z.boolean().optional().describe("Use as the overall default work type"),
      activityDefaultFlag: z.boolean().optional().describe("Use as default for activity time entries"),
      utilizationFlag: z.boolean().optional().describe("Count toward utilisation calculations"),
      costMultiplier: z.number().optional().describe("Cost multiplier"),
      addToHoursWorkedFlag: z.boolean().optional().describe("Add hours to member worked hours"),
      inactiveFlag: z.boolean().optional().describe("Mark the work type inactive"),
      integrationXref: z.string().optional().describe("External system cross-reference identifier"),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.billTime) body.billTime = args.billTime;
      if (args.rateType) body.rateType = args.rateType;
      if (args.hoursMultiplier !== undefined) body.hoursMultiplier = args.hoursMultiplier;
      if (args.overallDefaultFlag !== undefined) body.overallDefaultFlag = args.overallDefaultFlag;
      if (args.activityDefaultFlag !== undefined) body.activityDefaultFlag = args.activityDefaultFlag;
      if (args.utilizationFlag !== undefined) body.utilizationFlag = args.utilizationFlag;
      if (args.costMultiplier !== undefined) body.costMultiplier = args.costMultiplier;
      if (args.addToHoursWorkedFlag !== undefined) body.addToHoursWorkedFlag = args.addToHoursWorkedFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.integrationXref) body.integrationXref = args.integrationXref;
      const result = await client.post("/time/workTypes", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_work_type",
    "Update a work type via JSON Patch.",
    {
      id: z.number().describe("Work type ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/time/workTypes/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_work_type",
    "Delete a work type.",
    {
      id: z.number().describe("Work type ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/time/workTypes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Work roles ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_work_roles",
    "List work roles (e.g. Engineer, Project Manager).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/time/workRoles", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_work_role",
    "Get a work role.",
    {
      id: z.number().describe("Work role ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/workRoles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_work_role",
    "Create a work role.",
    {
      name: z.string().describe("Work role name"),
      hourlyRate: z.number().optional().describe("Hourly rate override"),
      inactiveFlag: z.boolean().optional().describe("Mark as inactive"),
      addAllWorkTypesFlag: z.boolean().optional().describe("Add all work types to this role"),
      removeAllWorkTypesFlag: z.boolean().optional().describe("Remove all work types from this role"),
      integrationXref: z.string().optional().describe("Integration cross-reference identifier"),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.hourlyRate !== undefined) body.hourlyRate = args.hourlyRate;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.addAllWorkTypesFlag !== undefined) body.addAllWorkTypesFlag = args.addAllWorkTypesFlag;
      if (args.removeAllWorkTypesFlag !== undefined) body.removeAllWorkTypesFlag = args.removeAllWorkTypesFlag;
      if (args.integrationXref) body.integrationXref = args.integrationXref;
      const result = await client.post("/time/workRoles", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_work_role",
    "Update a work role via JSON Patch.",
    {
      id: z.number().describe("Work role ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/time/workRoles/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_work_role",
    "Delete a work role.",
    {
      id: z.number().describe("Work role ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/time/workRoles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Time sheets ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_time_sheets",
    "List time sheets.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/time/sheets", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_time_sheet",
    "Get a time sheet.",
    {
      id: z.number().describe("Time sheet ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/sheets/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_submit_time_sheet",
    "Submit a time sheet for approval via /time/sheets/{id}/submit.",
    {
      id: z.number().describe("Time sheet ID"),
    },
    async ({ id }) => {
      const result = await client.post(`/time/sheets/${id}/submit`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_approve_time_sheet",
    "Approve a time sheet via /time/sheets/{id}/approve.",
    {
      id: z.number().describe("Time sheet ID"),
    },
    async ({ id }) => {
      const result = await client.post(`/time/sheets/${id}/approve`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_reject_time_sheet",
    "Reject a time sheet via /time/sheets/{id}/reject.",
    {
      id: z.number().describe("Time sheet ID"),
      reason: z.string().optional().describe("Rejection reason"),
    },
    async ({ id, reason }) => {
      const body: Record<string, unknown> = {};
      if (reason) body.reason = reason;
      const result = await client.post(`/time/sheets/${id}/reject`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_reverse_time_sheet",
    "Reverse an approved time sheet via /time/sheets/{id}/reverse.",
    {
      id: z.number().describe("Time sheet ID"),
    },
    async ({ id }) => {
      const result = await client.post(`/time/sheets/${id}/reverse`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_time_sheet_audits",
    "List audit-trail entries for a time sheet.",
    {
      sheetId: z.number().describe("Time sheet ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ sheetId, conditions, page, pageSize }) => {
      const result = await client.get(`/time/sheets/${sheetId}/audits`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Time accruals ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_time_accruals",
    "List time accruals (PTO / vacation banks).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/time/accruals", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_time_accrual",
    "Get a time accrual.",
    {
      id: z.number().describe("Time accrual ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/accruals/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Time periods & periodSetups ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_time_periods",
    "List time periods (the rolling buckets sheets attach to).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/time/periods", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_time_period",
    "Get a time period.",
    {
      id: z.number().describe("Time period ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/periods/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_time_period_setups",
    "List time-period setup definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/time/periodSetups", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Stop watches ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_stopwatches",
    "List stop watches.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/time/stopwatches", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_stopwatch",
    "Get a stop watch.",
    {
      id: z.number().describe("Stop watch ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/time/stopwatches/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
