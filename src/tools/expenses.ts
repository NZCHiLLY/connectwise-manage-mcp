import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

export function registerExpenseTools(server: McpServer, client: CwManageClient) {
  // ── /expense/entries ─────────────────────────────────────────────────────

  server.tool(
    "cw_search_expense_entries",
    "Search expense entries in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"member/id = 154 and date > [2026-05-01T00:00:00Z]\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/expense/entries", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_expense_entry",
    "Get a single expense entry by ID.",
    {
      id: z.number().describe("Expense entry ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/expense/entries/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_expense_entry",
    "Create an expense entry. Required: amount, date, member, type, billableOption. Dates use CW format with square brackets and Z suffix.",
    {
      amount: z.number().describe("Expense amount"),
      date: z.string().describe("Expense date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      memberId: z.number().describe("Member ID who incurred the expense"),
      typeId: z.number().describe("Expense type ID"),
      billableOption: z.string().describe("'Billable', 'DoNotBill', or 'NoCharge'"),
      companyId: z.number().optional().describe("Company ID the expense is for"),
      chargeToId: z.number().optional().describe("Ticket/project ID to charge to"),
      chargeToType: z.string().optional().describe("'ServiceTicket', 'ProjectTicket', 'ChargeCode', 'Activity'"),
      classificationId: z.number().optional().describe("Expense classification ID"),
      notes: z.string().optional().describe("Free-text notes"),
      invoiceAmount: z.number().optional().describe("Override invoice amount"),
      taxesId: z.number().optional().describe("Taxes ID"),
      paymentMethodId: z.number().optional().describe("Payment method ID"),
      currencyId: z.number().optional().describe("Currency ID"),
      mileage: z.number().optional().describe("Mileage (for mileage-type expenses)"),
      agreementId: z.number().optional().describe("Agreement ID for billing"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
    },
    async ({
      amount, date, memberId, typeId, billableOption, companyId,
      chargeToId, chargeToType, classificationId, notes, invoiceAmount,
      taxesId, paymentMethodId, currencyId, mileage, agreementId, locationId, businessUnitId,
    }) => {
      const body: Record<string, unknown> = {
        amount,
        date,
        member: { id: memberId },
        type: { id: typeId },
        billableOption,
      };
      if (companyId) body.company = { id: companyId };
      if (chargeToId) body.chargeToId = chargeToId;
      if (chargeToType) body.chargeToType = chargeToType;
      if (classificationId) body.classification = { id: classificationId };
      if (notes) body.notes = notes;
      if (invoiceAmount !== undefined) body.invoiceAmount = invoiceAmount;
      if (taxesId) body.taxes = { id: taxesId };
      if (paymentMethodId) body.paymentMethod = { id: paymentMethodId };
      if (currencyId) body.currency = { id: currencyId };
      if (mileage !== undefined) body.mileage = mileage;
      if (agreementId) body.agreement = { id: agreementId };
      if (locationId) body.location = { id: locationId };
      if (businessUnitId) body.businessUnit = { id: businessUnitId };

      const result = await client.post("/expense/entries", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_expense_entry",
    "Update an expense entry via JSON Patch operations.",
    {
      id: z.number().describe("Expense entry ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/expense/entries/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_expense_entry",
    "Delete an expense entry by ID.",
    {
      id: z.number().describe("Expense entry ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/expense/entries/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /expense/reports ─────────────────────────────────────────────────────

  server.tool(
    "cw_search_expense_reports",
    "Search expense reports (groupings of expense entries submitted for approval).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/expense/reports", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_expense_report",
    "Get a single expense report by ID.",
    {
      id: z.number().describe("Expense report ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/expense/reports/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_expense_report",
    "Create an expense report (a submission grouping multiple expense entries).",
    {
      memberId: z.number().describe("Member ID submitting the report"),
      dateStart: z.string().describe("Report period start in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      dateEnd: z.string().describe("Report period end in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      statusId: z.number().optional().describe("Status ID"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({ memberId, dateStart, dateEnd, statusId, notes }) => {
      const body: Record<string, unknown> = {
        member: { id: memberId },
        dateStart,
        dateEnd,
      };
      if (statusId) body.status = { id: statusId };
      if (notes) body.notes = notes;

      const result = await client.post("/expense/reports", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_expense_report",
    "Update an expense report via JSON Patch.",
    {
      id: z.number().describe("Expense report ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/expense/reports/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_expense_report",
    "Delete an expense report by ID.",
    {
      id: z.number().describe("Expense report ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/expense/reports/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_approve_expense_report",
    "Approve an expense report — moves it past the approval gate. POST to /expense/reports/{id}/approve.",
    {
      id: z.number().describe("Expense report ID"),
    },
    async ({ id }) => {
      const result = await client.post(`/expense/reports/${id}/approve`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_reject_expense_report",
    "Reject an expense report. POST to /expense/reports/{id}/reject.",
    {
      id: z.number().describe("Expense report ID"),
      reason: z.string().optional().describe("Optional rejection reason text"),
    },
    async ({ id, reason }) => {
      const body: Record<string, unknown> = {};
      if (reason) body.reason = reason;
      const result = await client.post(`/expense/reports/${id}/reject`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_submit_expense_report",
    "Submit an expense report for approval. POST to /expense/reports/{id}/submit.",
    {
      id: z.number().describe("Expense report ID"),
    },
    async ({ id }) => {
      const result = await client.post(`/expense/reports/${id}/submit`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_expense_report_entries",
    "List the expense entries contained in a given expense report.",
    {
      reportId: z.number().describe("Parent expense report ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ reportId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/expense/reports/${reportId}/entries`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /expense/classifications ─────────────────────────────────────────────

  server.tool(
    "cw_list_expense_classifications",
    "List expense classifications (the cost/revenue categorisation labels).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/expense/classifications", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_expense_classification",
    "Get a single expense classification by ID.",
    {
      id: z.number().describe("Classification ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/expense/classifications/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /expense/types ───────────────────────────────────────────────────────

  server.tool(
    "cw_list_expense_types",
    "List expense types (Meal, Mileage, Lodging, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/expense/types", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_expense_type",
    "Get a single expense type by ID.",
    {
      id: z.number().describe("Expense type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/expense/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_expense_type",
    "Create a new expense type.",
    {
      name: z.string().describe("Expense type name"),
      billableOption: z.string().describe("'Billable', 'DoNotBill', or 'NoCharge'"),
      mileageFlag: z.boolean().optional().describe("Whether this type is a mileage type"),
      amountFlag: z.boolean().optional().describe("Whether this type uses an amount field"),
      advanceAmountFlag: z.boolean().optional().describe("Whether advance amounts apply"),
      invoiceMarkupAmount: z.number().optional().describe("Markup amount when invoicing"),
      classificationId: z.number().optional().describe("Default classification ID"),
      paymentTypeId: z.number().optional().describe("Default payment type ID"),
    },
    async ({
      name, billableOption, mileageFlag, amountFlag, advanceAmountFlag,
      invoiceMarkupAmount, classificationId, paymentTypeId,
    }) => {
      const body: Record<string, unknown> = { name, billableOption };
      if (mileageFlag !== undefined) body.mileageFlag = mileageFlag;
      if (amountFlag !== undefined) body.amountFlag = amountFlag;
      if (advanceAmountFlag !== undefined) body.advanceAmountFlag = advanceAmountFlag;
      if (invoiceMarkupAmount !== undefined) body.invoiceMarkupAmount = invoiceMarkupAmount;
      if (classificationId) body.classification = { id: classificationId };
      if (paymentTypeId) body.paymentType = { id: paymentTypeId };

      const result = await client.post("/expense/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_expense_type",
    "Update an expense type via JSON Patch.",
    {
      id: z.number().describe("Expense type ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/expense/types/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
