import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";
import { sentinelParams } from "./shared.js";

/**
 * Finance tools — full coverage of /finance subtree.
 * Supersedes the original agreements.ts (kept the original 5 tools and adds
 * the missing create/update/cancel/copy, additions CRUD, workroles, sites,
 * invoice email/pay actions, payments, plus the broader lookup tables.
 *
 * Register this file's `registerFinanceTools` INSTEAD OF `registerAgreementTools`.
 */

export function registerFinanceTools(server: McpServer, client: CwManageClient) {
  // ── /finance/agreements (full CRUD + actions) ────────────────────────────

  server.tool(
    "cw_search_agreements",
    "Search agreements in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"agreementStatus = 'Active' and company/name = 'Acme Corp'\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/agreements", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_agreement",
    "Get a single agreement by ID.",
    {
      id: z.number().describe("Agreement ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/agreements/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_agreement",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create an agreement. Required: name, type, company, contact.",
    {
      name: z.string().describe("Agreement name"),
      typeId: z.number().describe("Agreement type ID"),
      companyId: z.number().describe("Company ID"),
      contactId: z.number().describe("Primary contact ID"),
      siteId: z.number().optional().describe("Site ID"),
      startDate: z.string().optional().describe("Start date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      endDate: z.string().optional().describe("End date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      noEndingDateFlag: z.boolean().optional().describe("True for indefinite agreements"),
      billAmount: z.number().optional().describe("Bill amount"),
      billingCycleId: z.number().optional().describe("Billing cycle ID"),
      billingTermsId: z.number().optional().describe("Billing terms ID"),
      taxableFlag: z.boolean().optional().describe("Taxable?"),
      invoiceDescription: z.string().optional().describe("Invoice description text"),
      restrictDownPayment: z.boolean().optional().describe("Restrict down payment"),
      prorateFirstBillFlag: z.boolean().optional().describe("Prorate first bill"),
      compositeInvoiceFlag: z.boolean().optional().describe("Composite invoice flag"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      locationId: z.number().optional().describe("Location ID"),
      departmentId: z.number().optional().describe("Department ID"),
      parentAgreementId: z.number().optional().describe("Parent agreement ID"),
      cancelledFlag: z.boolean().optional().describe("Cancelled flag"),
      dateCancelled: z.string().optional().describe("Cancellation date in CW format"),
      reasonCancelled: z.string().optional().describe("Cancellation reason"),
      sla: z.object({ id: z.number() }).optional().describe("SLA reference"),
      workOrder: z.string().optional().describe("PO/work order text"),
      internalNotes: z.string().optional().describe("Internal notes"),
      applicationUnits: z.string().optional().describe("Application units"),
      applicationLimit: z.number().optional().describe("Application limit"),
      applicationCycle: z.string().optional().describe("Application cycle"),
      applicationUnlimitedFlag: z.boolean().optional().describe("Unlimited application"),
      oneTimeFlag: z.boolean().optional().describe("One-time agreement"),
      coverAgreementTime: z.boolean().optional().describe("Cover agreement time"),
      coverAgreementProduct: z.boolean().optional().describe("Cover agreement product"),
      coverAgreementExpense: z.boolean().optional().describe("Cover agreement expense"),
      coverSalesTax: z.boolean().optional().describe("Cover sales tax"),
      carryOverUnused: z.boolean().optional().describe("Carry over unused"),
      allowOverruns: z.boolean().optional().describe("Allow overruns"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_agreement", entityType: "agreement", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        name: args.name,
        type: { id: args.typeId },
        company: { id: args.companyId },
        contact: { id: args.contactId },
      };
      if (args.siteId) body.site = { id: args.siteId };
      if (args.startDate) body.startDate = args.startDate;
      if (args.endDate) body.endDate = args.endDate;
      if (args.noEndingDateFlag !== undefined) body.noEndingDateFlag = args.noEndingDateFlag;
      if (args.billAmount !== undefined) body.billAmount = args.billAmount;
      if (args.billingCycleId) body.billingCycle = { id: args.billingCycleId };
      if (args.billingTermsId) body.billingTerms = { id: args.billingTermsId };
      if (args.taxableFlag !== undefined) body.taxableFlag = args.taxableFlag;
      if (args.invoiceDescription) body.invoiceDescription = args.invoiceDescription;
      if (args.restrictDownPayment !== undefined) body.restrictDownPayment = args.restrictDownPayment;
      if (args.prorateFirstBillFlag !== undefined) body.prorateFirstBillFlag = args.prorateFirstBillFlag;
      if (args.compositeInvoiceFlag !== undefined) body.compositeInvoiceFlag = args.compositeInvoiceFlag;
      if (args.businessUnitId) body.businessUnit = { id: args.businessUnitId };
      if (args.locationId) body.location = { id: args.locationId };
      if (args.departmentId) body.department = { id: args.departmentId };
      if (args.parentAgreementId) body.parentAgreement = { id: args.parentAgreementId };
      if (args.cancelledFlag !== undefined) body.cancelledFlag = args.cancelledFlag;
      if (args.dateCancelled) body.dateCancelled = args.dateCancelled;
      if (args.reasonCancelled) body.reasonCancelled = args.reasonCancelled;
      if (args.sla) body.sla = args.sla;
      if (args.workOrder) body.workOrder = args.workOrder;
      if (args.internalNotes) body.internalNotes = args.internalNotes;
      if (args.applicationUnits) body.applicationUnits = args.applicationUnits;
      if (args.applicationLimit !== undefined) body.applicationLimit = args.applicationLimit;
      if (args.applicationCycle) body.applicationCycle = args.applicationCycle;
      if (args.applicationUnlimitedFlag !== undefined) body.applicationUnlimitedFlag = args.applicationUnlimitedFlag;
      if (args.oneTimeFlag !== undefined) body.oneTimeFlag = args.oneTimeFlag;
      if (args.coverAgreementTime !== undefined) body.coverAgreementTime = args.coverAgreementTime;
      if (args.coverAgreementProduct !== undefined) body.coverAgreementProduct = args.coverAgreementProduct;
      if (args.coverAgreementExpense !== undefined) body.coverAgreementExpense = args.coverAgreementExpense;
      if (args.coverSalesTax !== undefined) body.coverSalesTax = args.coverSalesTax;
      if (args.carryOverUnused !== undefined) body.carryOverUnused = args.carryOverUnused;
      if (args.allowOverruns !== undefined) body.allowOverruns = args.allowOverruns;

      const result = await client.post("/finance/agreements", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_agreement",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an agreement via JSON Patch. Common ops: replace endDate, replace billAmount, replace cancelledFlag.",
    {
      id: z.number().describe("Agreement ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_agreement", entityType: "agreement", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/finance/agreements/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_cancel_agreement",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Cancel an agreement by patching cancelledFlag=true (DELETE on active agreement returns 400).",
    {
      id: z.number().describe("Agreement ID"),
      dateCancelled: z.string().optional().describe("Cancellation date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      reasonCancelled: z.string().optional().describe("Reason text"),
      ...sentinelParams,
    },
    async ({ id, dateCancelled, reasonCancelled, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_cancel_agreement", entityType: "agreement", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const ops: Array<{ op: string; path: string; value: unknown }> = [
        { op: "replace", path: "cancelledFlag", value: true },
      ];
      if (dateCancelled) ops.push({ op: "replace", path: "dateCancelled", value: dateCancelled });
      if (reasonCancelled) ops.push({ op: "replace", path: "reasonCancelled", value: reasonCancelled });
      const result = await client.patch(`/finance/agreements/${id}`, ops);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_agreement",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete an agreement. Note: CW returns 400 on active agreements — use cw_cancel_agreement instead unless the agreement was never activated.",
    {
      id: z.number().describe("Agreement ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_agreement", entityType: "agreement", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/finance/agreements/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_agreement",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Copy/clone an agreement. Optional 'overrides' merges onto the new agreement.",
    {
      id: z.number().describe("Source agreement ID"),
      overrides: z.record(z.string(), z.unknown()).optional().describe("Optional Agreement fields to override on the copy"),
      ...sentinelParams,
    },
    async ({ id, overrides, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_copy_agreement", entityType: "agreement", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/finance/agreements/${id}/copy`, overrides ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/agreements/{id}/additions ───────────────────────────────────

  server.tool(
    "cw_get_agreement_additions",
    "Get additions (line items) for a specific agreement.",
    {
      agreementId: z.number().describe("Agreement ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ agreementId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/additions`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_agreement_addition",
    "Get a single agreement addition by ID.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      additionId: z.number().describe("Addition ID"),
    },
    async ({ agreementId, additionId }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/additions/${additionId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_agreement_addition",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create an agreement addition (line item).",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      productId: z.number().describe("Catalog item / product ID"),
      quantity: z.number().describe("Quantity"),
      billCustomer: z.string().describe("'Billable', 'DoNotBill', or 'NoCharge'"),
      lessIncludedQuantity: z.number().optional().describe("Less included quantity"),
      unitPrice: z.number().optional().describe("Unit price override"),
      unitCost: z.number().optional().describe("Unit cost override"),
      effectiveDate: z.string().optional().describe("Effective date in CW format"),
      cancelledDate: z.string().optional().describe("Cancellation date in CW format"),
      taxableFlag: z.boolean().optional().describe("Taxable?"),
      serialNumber: z.string().optional().describe("Serial number"),
      invoiceDescription: z.string().optional().describe("Invoice description"),
      purchaseItemFlag: z.boolean().optional().describe("Purchase item flag"),
      specialOrderFlag: z.boolean().optional().describe("Special order flag"),
      description: z.string().optional().describe("Description override"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_agreement_addition", entityType: "agreement_addition", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        product: { id: args.productId },
        quantity: args.quantity,
        billCustomer: args.billCustomer,
      };
      if (args.lessIncludedQuantity !== undefined) body.lessIncludedQuantity = args.lessIncludedQuantity;
      if (args.unitPrice !== undefined) body.unitPrice = args.unitPrice;
      if (args.unitCost !== undefined) body.unitCost = args.unitCost;
      if (args.effectiveDate) body.effectiveDate = args.effectiveDate;
      if (args.cancelledDate) body.cancelledDate = args.cancelledDate;
      if (args.taxableFlag !== undefined) body.taxableFlag = args.taxableFlag;
      if (args.serialNumber) body.serialNumber = args.serialNumber;
      if (args.invoiceDescription) body.invoiceDescription = args.invoiceDescription;
      if (args.purchaseItemFlag !== undefined) body.purchaseItemFlag = args.purchaseItemFlag;
      if (args.specialOrderFlag !== undefined) body.specialOrderFlag = args.specialOrderFlag;
      if (args.description) body.description = args.description;

      const result = await client.post(`/finance/agreements/${args.agreementId}/additions`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_agreement_addition",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an agreement addition via JSON Patch.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      additionId: z.number().describe("Addition ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ agreementId, additionId, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_agreement_addition", entityType: "agreement_addition", entityId: additionId, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/finance/agreements/${agreementId}/additions/${additionId}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_agreement_addition",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete an agreement addition by ID.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      additionId: z.number().describe("Addition ID"),
      ...sentinelParams,
    },
    async ({ agreementId, additionId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_agreement_addition", entityType: "agreement_addition", entityId: additionId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/finance/agreements/${agreementId}/additions/${additionId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/agreements/{id}/workroles ───────────────────────────────────

  server.tool(
    "cw_list_agreement_workroles",
    "List per-agreement work role overrides (rate cards).",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ agreementId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/workroles`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_agreement_workrole",
    "Get a single per-agreement work role override by ID.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      workRoleId: z.number().describe("Work role override ID"),
    },
    async ({ agreementId, workRoleId }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/workroles/${workRoleId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_agreement_workrole",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a work role override to an agreement (rate card entry).",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      workRoleId: z.number().describe("Work role ID to override"),
      rate: z.number().describe("Rate to apply"),
      effectiveDate: z.string().optional().describe("Effective date in CW format"),
      endingDate: z.string().optional().describe("Ending date in CW format"),
      rateType: z.string().optional().describe("Rate type ('Standard', 'Adjustment', etc.)"),
      limitTo: z.number().optional().describe("Hour limit on this rate"),
      ...sentinelParams,
    },
    async ({ agreementId, workRoleId, rate, effectiveDate, endingDate, rateType, limitTo, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_agreement_workrole", entityType: "agreement_workrole", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {
        workRole: { id: workRoleId },
        rate,
      };
      if (effectiveDate) body.effectiveDate = effectiveDate;
      if (endingDate) body.endingDate = endingDate;
      if (rateType) body.rateType = rateType;
      if (limitTo !== undefined) body.limitTo = limitTo;

      const result = await client.post(`/finance/agreements/${agreementId}/workroles`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_agreement_workrole",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an agreement work role override via JSON Patch.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      workRoleId: z.number().describe("Work role override ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ agreementId, workRoleId, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_agreement_workrole", entityType: "agreement_workrole", entityId: workRoleId, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/finance/agreements/${agreementId}/workroles/${workRoleId}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_agreement_workrole",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a work role override from an agreement.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      workRoleId: z.number().describe("Work role override ID"),
      ...sentinelParams,
    },
    async ({ agreementId, workRoleId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_agreement_workrole", entityType: "agreement_workrole", entityId: workRoleId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/finance/agreements/${agreementId}/workroles/${workRoleId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/agreements/{id}/worktypes ───────────────────────────────────

  server.tool(
    "cw_list_agreement_worktypes",
    "List per-agreement work type overrides.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ agreementId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/worktypes`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_agreement_sites",
    "List sites attached to an agreement.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ agreementId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/sites`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_agreement_configurations",
    "List configurations attached to an agreement.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ agreementId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/configurations`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_agreement_boards",
    "List service boards covered by an agreement.",
    {
      agreementId: z.number().describe("Parent agreement ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ agreementId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/finance/agreements/${agreementId}/boards`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/agreementTypes ──────────────────────────────────────────────

  server.tool(
    "cw_list_agreement_types",
    "List agreement type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/agreementTypes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_agreement_type",
    "Get a single agreement type by ID.",
    {
      id: z.number().describe("Agreement type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/agreementTypes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/workRoles (global catalogue) ────────────────────────────────

  server.tool(
    "cw_list_work_roles",
    "List the global work roles catalogue (Tier 1, Tier 2, Project Manager, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/workRoles", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_work_role",
    "Get a single global work role by ID.",
    {
      id: z.number().describe("Work role ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/workRoles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/invoices ────────────────────────────────────────────────────

  server.tool(
    "cw_search_invoices",
    "Search invoices in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"status/name = 'Open' and company/id = 17\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/invoices", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_invoice",
    "Get a single invoice by ID.",
    {
      id: z.number().describe("Invoice ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/invoices/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_invoice",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an invoice via JSON Patch. Common ops: replace status/id, replace dueDate.",
    {
      id: z.number().describe("Invoice ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_invoice", entityType: "invoice", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/finance/invoices/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_invoice",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete an invoice by ID. CW may reject if posted to GL — handle 400/422.",
    {
      id: z.number().describe("Invoice ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_invoice", entityType: "invoice", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/finance/invoices/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_email_invoice",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Email an invoice to a recipient. POST to /finance/invoices/{id}/email.",
    {
      id: z.number().describe("Invoice ID"),
      to: z.string().optional().describe("Comma-separated recipient email addresses"),
      cc: z.string().optional().describe("Comma-separated CC email addresses"),
      bcc: z.string().optional().describe("Comma-separated BCC email addresses"),
      subject: z.string().optional().describe("Email subject override"),
      body: z.string().optional().describe("Email body override"),
      ...sentinelParams,
    },
    async ({ id, to, cc, bcc, subject, body: emailBody, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_email_invoice", entityType: "invoice", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {};
      if (to) body.to = to;
      if (cc) body.cc = cc;
      if (bcc) body.bcc = bcc;
      if (subject) body.subject = subject;
      if (emailBody) body.body = emailBody;
      const result = await client.post(`/finance/invoices/${id}/email`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_pay_invoice",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Record a payment against an invoice. POST to /finance/invoices/{id}/pay.",
    {
      id: z.number().describe("Invoice ID"),
      amount: z.number().describe("Payment amount"),
      paymentDate: z.string().optional().describe("Payment date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      paymentMethodId: z.number().optional().describe("Payment method ID"),
      paymentTypeId: z.number().optional().describe("Payment type ID"),
      checkNumber: z.string().optional().describe("Check / reference number"),
      memo: z.string().optional().describe("Memo / notes"),
      ...sentinelParams,
    },
    async ({ id, amount, paymentDate, paymentMethodId, paymentTypeId, checkNumber, memo, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_pay_invoice", entityType: "invoice", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { amount };
      if (paymentDate) body.paymentDate = paymentDate;
      if (paymentMethodId) body.paymentMethod = { id: paymentMethodId };
      if (paymentTypeId) body.paymentType = { id: paymentTypeId };
      if (checkNumber) body.checkNumber = checkNumber;
      if (memo) body.memo = memo;
      const result = await client.post(`/finance/invoices/${id}/pay`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/payments ────────────────────────────────────────────────────

  server.tool(
    "cw_search_payments",
    "Search payments in ConnectWise Manage.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/payments", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_payment",
    "Get a single payment by ID.",
    {
      id: z.number().describe("Payment ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/payments/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/billingCycles ───────────────────────────────────────────────

  server.tool(
    "cw_list_billing_cycles",
    "List billing cycle definitions (Monthly, Quarterly, Annual, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/billingCycles", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_billing_terms",
    "List billing terms definitions (Net 30, Net 60, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/billingTerms", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_billing_statuses",
    "List billing status definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/billingStatuses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_billing_setups",
    "List billing setup configurations.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/billingSetups", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/glAccounts ──────────────────────────────────────────────────

  server.tool(
    "cw_list_gl_accounts",
    "List GL (general ledger) account mappings.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/glAccounts", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_gl_types",
    "List GL type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/glTypes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_gl_payment_types",
    "List GL payment type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/glPaymentTypes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/taxCodes ────────────────────────────────────────────────────

  server.tool(
    "cw_list_tax_codes",
    "List tax code definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/taxCodes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_tax_code",
    "Get a single tax code by ID.",
    {
      id: z.number().describe("Tax code ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/taxCodes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/currencies ──────────────────────────────────────────────────

  server.tool(
    "cw_list_currencies",
    "List currency definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/currencies", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/invoiceTemplates ────────────────────────────────────────────

  server.tool(
    "cw_list_invoice_templates",
    "List invoice template definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/invoiceTemplates", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/deliveryMethods ─────────────────────────────────────────────

  server.tool(
    "cw_list_delivery_methods",
    "List invoice delivery method definitions (Email, Mail, Portal).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/deliveryMethods", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /finance/accounting/batches ──────────────────────────────────────────

  server.tool(
    "cw_list_accounting_batches",
    "List accounting batches (export batches to external accounting systems).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/finance/accounting/batches", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_accounting_batch",
    "Get a single accounting batch by ID.",
    {
      id: z.number().describe("Accounting batch ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/finance/accounting/batches/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
