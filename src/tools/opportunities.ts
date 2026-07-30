import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";
import { patchOp, sentinelParams } from "./shared.js";

export function registerOpportunityTools(server: McpServer, client: CwManageClient) {
  // ── Opportunities ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_search_opportunities",
    "Search sales opportunities. Use 'conditions' for CW query syntax.",
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
      const result = await client.get("/sales/opportunities", {
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
    "cw_get_opportunity",
    "Get a single opportunity by ID.",
    {
      id: z.number().describe("Opportunity ID"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/sales/opportunities/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_opportunities",
    "Count opportunities matching a conditions query.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Child object conditions query string"),
      customFieldConditions: z.string().optional().describe("Custom field conditions query string"),
    },
    async (args) => {
      const result = await client.get("/sales/opportunities/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a new sales opportunity. name, companyId, typeId, primarySalesRepId, stageId are required.",
    {
      name: z.string().describe("Opportunity name (required)"),
      companyId: z.number().describe("Customer company ID (required)"),
      typeId: z.number().describe("Opportunity type ID (required)"),
      primarySalesRepId: z.number().describe("Primary sales rep member ID (required)"),
      stageId: z.number().describe("Sales stage ID (required)"),
      statusId: z.number().optional().describe("Opportunity status ID"),
      ratingId: z.number().optional().describe("Rating ID"),
      priorityId: z.number().optional().describe("Priority ID"),
      probability: z.number().optional().describe("Win probability (0–100)"),
      source: z.string().optional().describe("Lead source"),
      contactId: z.number().optional().describe("Contact ID"),
      siteId: z.number().optional().describe("Site ID"),
      campaignId: z.number().optional().describe("Campaign ID"),
      expectedCloseDate: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      dateBecameLead: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      pipelineChangeDate: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      lastStageChangeDate: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      closedDate: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      notes: z.string().optional().describe("Opportunity notes"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      locationId: z.number().optional().describe("Location ID"),
      departmentId: z.number().optional().describe("Department ID"),
      territoryId: z.number().optional().describe("Territory ID"),
      secondarySalesRepId: z.number().optional().describe("Secondary sales rep member ID"),
      customerPO: z.string().optional().describe("Customer purchase order number"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional().describe("Custom field values"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_opportunity", entityType: "opportunity", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        name: args.name,
        company: { id: args.companyId },
        type: { id: args.typeId },
        primarySalesRep: { id: args.primarySalesRepId },
        stage: { id: args.stageId },
      };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.ratingId !== undefined) body.rating = { id: args.ratingId };
      if (args.priorityId !== undefined) body.priority = { id: args.priorityId };
      if (args.probability !== undefined) body.probability = { id: args.probability };
      if (args.source) body.source = args.source;
      if (args.contactId !== undefined) body.contact = { id: args.contactId };
      if (args.siteId !== undefined) body.site = { id: args.siteId };
      if (args.campaignId !== undefined) body.campaign = { id: args.campaignId };
      if (args.expectedCloseDate) body.expectedCloseDate = args.expectedCloseDate;
      if (args.dateBecameLead) body.dateBecameLead = args.dateBecameLead;
      if (args.pipelineChangeDate) body.pipelineChangeDate = args.pipelineChangeDate;
      if (args.lastStageChangeDate) body.lastStageChangeDate = args.lastStageChangeDate;
      if (args.closedDate) body.closedDate = args.closedDate;
      if (args.notes) body.notes = args.notes;
      if (args.businessUnitId !== undefined) body.businessUnit = { id: args.businessUnitId };
      if (args.locationId !== undefined) body.location = { id: args.locationId };
      if (args.departmentId !== undefined) body.department = { id: args.departmentId };
      if (args.territoryId !== undefined) body.territory = { id: args.territoryId };
      if (args.secondarySalesRepId !== undefined) body.secondarySalesRep = { id: args.secondarySalesRepId };
      if (args.customerPO) body.customerPO = args.customerPO;
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/sales/opportunities", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an opportunity via JSON Patch. Use to edit, amend, correct, revise or patch an existing record.",
    {
      id: z.number().describe("Opportunity ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ id, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_opportunity", entityType: "opportunity", entityId: id, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/sales/opportunities/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Replace an opportunity via PUT.",
    {
      id: z.number().describe("Opportunity ID"),
      body: z.record(z.string(), z.unknown()).describe("Full replacement body for PUT"),
      ...sentinelParams,
    },
    async ({ id, body, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_replace_opportunity", entityType: "opportunity", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.put(`/sales/opportunities/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete an opportunity.",
    {
      id: z.number().describe("Opportunity ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_opportunity", entityType: "opportunity", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/sales/opportunities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Copy an opportunity to a new one via /sales/opportunities/{id}/copy.",
    {
      id: z.number().describe("Source opportunity ID"),
      name: z.string().optional().describe("Override name on the copy"),
      ...sentinelParams,
    },
    async ({ id, name, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_copy_opportunity", entityType: "opportunity", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {};
      if (name) body.name = name;
      const result = await client.post(`/sales/opportunities/${id}/copy`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_win_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Mark an opportunity as won. Provide a closed status with wonFlag=true via JSON Patch.",
    {
      id: z.number().describe("Opportunity ID"),
      statusId: z.number().describe("Status ID where wonFlag=true and closedFlag=true"),
      closedDate: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_win_opportunity", entityType: "opportunity", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const patch: Array<Record<string, unknown>> = [
        { op: "replace", path: "/status/id", value: args.statusId },
      ];
      if (args.closedDate) {
        patch.push({ op: "replace", path: "/closedDate", value: args.closedDate });
      }
      const result = await client.patch(`/sales/opportunities/${args.id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_lose_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Mark an opportunity as lost. Provide a closed status with lostFlag=true via JSON Patch.",
    {
      id: z.number().describe("Opportunity ID"),
      statusId: z.number().describe("Status ID where lostFlag=true and closedFlag=true"),
      closedDate: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_lose_opportunity", entityType: "opportunity", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const patch: Array<Record<string, unknown>> = [
        { op: "replace", path: "/status/id", value: args.statusId },
      ];
      if (args.closedDate) {
        patch.push({ op: "replace", path: "/closedDate", value: args.closedDate });
      }
      const result = await client.patch(`/sales/opportunities/${args.id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_reopen_opportunity",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Reopen a closed opportunity. Provide an open status (closedFlag=false) via JSON Patch.",
    {
      id: z.number().describe("Opportunity ID"),
      statusId: z.number().describe("Open status ID (closedFlag=false)"),
      ...sentinelParams,
    },
    async ({ id, statusId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_reopen_opportunity", entityType: "opportunity", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const patch: Array<Record<string, unknown>> = [
        { op: "replace", path: "/status/id", value: statusId },
        { op: "remove", path: "/closedDate" },
      ];
      const result = await client.patch(`/sales/opportunities/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_convert_opportunity_to_project",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Convert an opportunity to a project via /sales/opportunities/{id}/convertToProject.",
    {
      id: z.number().describe("Opportunity ID"),
      name: z.string().optional().describe("Project name (defaults to opportunity name)"),
      boardId: z.number().describe("Destination service board ID"),
      statusId: z.number().optional().describe("Project status ID"),
      typeId: z.number().optional().describe("Project type ID"),
      managerId: z.number().optional().describe("Project manager member ID"),
      estimatedStart: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      estimatedEnd: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_convert_opportunity_to_project", entityType: "opportunity", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        board: { id: args.boardId },
      };
      if (args.name) body.name = args.name;
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.managerId !== undefined) body.manager = { id: args.managerId };
      if (args.estimatedStart) body.estimatedStart = args.estimatedStart;
      if (args.estimatedEnd) body.estimatedEnd = args.estimatedEnd;
      const result = await client.post(`/sales/opportunities/${args.id}/convertToProject`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_convert_opportunity_to_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Convert an opportunity to a ticket via /sales/opportunities/{id}/convertToServiceTicket.",
    {
      id: z.number().describe("Opportunity ID"),
      summary: z.string().optional().describe("Ticket summary (defaults to opportunity name)"),
      boardId: z.number().describe("Destination board ID"),
      statusId: z.number().optional().describe("Ticket status ID"),
      priorityId: z.number().optional().describe("Ticket priority ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_convert_opportunity_to_ticket", entityType: "opportunity", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        board: { id: args.boardId },
      };
      if (args.summary) body.summary = args.summary;
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.priorityId !== undefined) body.priority = { id: args.priorityId };
      const result = await client.post(`/sales/opportunities/${args.id}/convertToServiceTicket`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_recalculate_opportunity_prices",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Recalculate prices on an opportunity (refreshes from current catalog and agreement pricing).",
    {
      id: z.number().describe("Opportunity ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_recalculate_opportunity_prices", entityType: "opportunity", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/sales/opportunities/${id}/recalculatePrices`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity products ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_products",
    "List products on an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ opportunityId, conditions, page, pageSize }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/products`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_opportunity_product",
    "Get a single product on an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      productId: z.number().describe("Opportunity product ID"),
    },
    async ({ opportunityId, productId }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/products/${productId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_opportunity_product",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a product to an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      catalogItemId: z.number().describe("Catalog item ID"),
      quantity: z.number().describe("Quantity"),
      price: z.number().optional().describe("Override unit price"),
      cost: z.number().optional().describe("Override unit cost"),
      priceMethod: z.string().optional().describe("MarkupCost | MarginCost | MarkupCostPercent | MarginCostPercent | OverridePrice"),
      sequenceNumber: z.number().optional().describe("Display order sequence number"),
      description: z.string().optional().describe("Product line description"),
      billableOption: z.string().optional().describe("Billable | DoNotBill | NoCharge"),
      taxableFlag: z.boolean().optional().describe("Whether the product is taxable"),
      dropshipFlag: z.boolean().optional().describe("Whether to dropship this product"),
      specialOrderFlag: z.boolean().optional().describe("Whether this is a special order"),
      forecastDetailId: z.number().optional().describe("Forecast detail ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_opportunity_product", entityType: "opportunity_product", entityId: args.opportunityId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        catalogItem: { id: args.catalogItemId },
        quantity: args.quantity,
      };
      if (args.price !== undefined) body.price = args.price;
      if (args.cost !== undefined) body.cost = args.cost;
      if (args.priceMethod) body.priceMethod = args.priceMethod;
      if (args.sequenceNumber !== undefined) body.sequenceNumber = args.sequenceNumber;
      if (args.description) body.description = args.description;
      if (args.billableOption) body.billableOption = args.billableOption;
      if (args.taxableFlag !== undefined) body.taxableFlag = args.taxableFlag;
      if (args.dropshipFlag !== undefined) body.dropshipFlag = args.dropshipFlag;
      if (args.specialOrderFlag !== undefined) body.specialOrderFlag = args.specialOrderFlag;
      if (args.forecastDetailId !== undefined) body.forecastDetail = { id: args.forecastDetailId };
      const result = await client.post(`/sales/opportunities/${args.opportunityId}/products`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_opportunity_product",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an opportunity product via JSON Patch. Use to edit, amend, correct, revise or patch an existing record.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      productId: z.number().describe("Opportunity product ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ opportunityId, productId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_opportunity_product", entityType: "opportunity_product", entityId: productId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/sales/opportunities/${opportunityId}/products/${productId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity_product",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a product from an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      productId: z.number().describe("Opportunity product ID"),
      ...sentinelParams,
    },
    async ({ opportunityId, productId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_opportunity_product", entityType: "opportunity_product", entityId: productId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/sales/opportunities/${opportunityId}/products/${productId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity contacts ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_contacts",
    "List contacts on an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ opportunityId, conditions, page, pageSize }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/contacts`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_opportunity_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Attach a contact to an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      contactId: z.number().describe("Contact ID"),
      ...sentinelParams,
    },
    async ({ opportunityId, contactId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_add_opportunity_contact", entityType: "opportunity_contact", entityId: opportunityId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/sales/opportunities/${opportunityId}/contacts`, {
        id: contactId,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_remove_opportunity_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a contact from an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      contactId: z.number().describe("Contact ID"),
      ...sentinelParams,
    },
    async ({ opportunityId, contactId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_remove_opportunity_contact", entityType: "opportunity_contact", entityId: contactId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/sales/opportunities/${opportunityId}/contacts/${contactId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity notes ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_notes",
    "List notes on an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ opportunityId, conditions, page, pageSize }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/notes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_opportunity_note",
    "Get a single opportunity note.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      noteId: z.number().describe("Opportunity note ID"),
    },
    async ({ opportunityId, noteId }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_opportunity_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a note to an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      text: z.string().describe("Note text"),
      typeId: z.number().optional().describe("Note type ID"),
      flagged: z.boolean().optional().describe("Flag the note as important"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_opportunity_note", entityType: "opportunity_note", entityId: args.opportunityId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/sales/opportunities/${args.opportunityId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_opportunity_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an opportunity note via JSON Patch. Use to edit, amend, correct, revise or rewrite the text/body of an existing note.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      noteId: z.number().describe("Opportunity note ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ opportunityId, noteId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_opportunity_note", entityType: "opportunity_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/sales/opportunities/${opportunityId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete an opportunity note.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      noteId: z.number().describe("Opportunity note ID"),
      ...sentinelParams,
    },
    async ({ opportunityId, noteId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_opportunity_note", entityType: "opportunity_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/sales/opportunities/${opportunityId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity catalog: ratings, types, statuses, note types ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_ratings",
    "List opportunity ratings.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/opportunities/ratings", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_opportunity_rating",
    "Get an opportunity rating.",
    {
      id: z.number().describe("Rating ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/opportunities/ratings/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_opportunity_note_types",
    "List opportunity note types.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/opportunities/notes/types", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
