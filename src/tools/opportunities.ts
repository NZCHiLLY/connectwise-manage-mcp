import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerOpportunityTools(server: McpServer, client: CwManageClient) {
  // ===== Opportunities =====

  server.tool(
    "cw_search_opportunities",
    "Search sales opportunities. Use 'conditions' for CW query syntax.",
    {
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
      fields: z.string().optional(),
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
      fields: z.string().optional(),
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
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
    },
    async (args) => {
      const result = await client.get("/sales/opportunities/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_opportunity",
    "Create a new sales opportunity. name, companyId, typeId, primarySalesRepId, stageId are required.",
    {
      name: z.string().describe("Opportunity name (required)"),
      companyId: z.number().describe("Customer company ID (required)"),
      typeId: z.number().describe("Opportunity type ID (required)"),
      primarySalesRepId: z.number().describe("Primary sales rep member ID (required)"),
      stageId: z.number().describe("Sales stage ID (required)"),
      statusId: z.number().optional(),
      ratingId: z.number().optional(),
      priorityId: z.number().optional(),
      probability: z.number().optional(),
      source: z.string().optional(),
      contactId: z.number().optional(),
      siteId: z.number().optional(),
      campaignId: z.number().optional(),
      expectedCloseDate: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      dateBecameLead: z.string().optional(),
      pipelineChangeDate: z.string().optional(),
      lastStageChangeDate: z.string().optional(),
      closedDate: z.string().optional(),
      notes: z.string().optional(),
      businessUnitId: z.number().optional(),
      locationId: z.number().optional(),
      departmentId: z.number().optional(),
      territoryId: z.number().optional(),
      secondarySalesRepId: z.number().optional(),
      customerPO: z.string().optional(),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
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
    "Update an opportunity via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/opportunities/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_opportunity",
    "Replace an opportunity via PUT.",
    {
      id: z.number(),
      body: z.record(z.string(), z.unknown()),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/sales/opportunities/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity",
    "Delete an opportunity.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/opportunities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_opportunity",
    "Copy an opportunity to a new one via /sales/opportunities/{id}/copy.",
    {
      id: z.number().describe("Source opportunity ID"),
      name: z.string().optional().describe("Override name on the copy"),
    },
    async ({ id, name }) => {
      const body: Record<string, unknown> = {};
      if (name) body.name = name;
      const result = await client.post(`/sales/opportunities/${id}/copy`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_win_opportunity",
    "Mark an opportunity as won. Provide a closed status with wonFlag=true via JSON Patch.",
    {
      id: z.number(),
      statusId: z.number().describe("Status ID where wonFlag=true and closedFlag=true"),
      closedDate: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
    },
    async (args) => {
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
    "Mark an opportunity as lost. Provide a closed status with lostFlag=true via JSON Patch.",
    {
      id: z.number(),
      statusId: z.number().describe("Status ID where lostFlag=true and closedFlag=true"),
      closedDate: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
    },
    async (args) => {
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
    "Reopen a closed opportunity. Provide an open status (closedFlag=false) via JSON Patch.",
    {
      id: z.number(),
      statusId: z.number().describe("Open status ID (closedFlag=false)"),
    },
    async ({ id, statusId }) => {
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
    "Convert an opportunity to a project via /sales/opportunities/{id}/convertToProject.",
    {
      id: z.number(),
      name: z.string().optional().describe("Project name (defaults to opportunity name)"),
      boardId: z.number().describe("Destination service board ID"),
      statusId: z.number().optional(),
      typeId: z.number().optional(),
      managerId: z.number().optional(),
      estimatedStart: z.string().optional(),
      estimatedEnd: z.string().optional(),
    },
    async (args) => {
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
    "Convert an opportunity to a ticket via /sales/opportunities/{id}/convertToServiceTicket.",
    {
      id: z.number(),
      summary: z.string().optional().describe("Ticket summary (defaults to opportunity name)"),
      boardId: z.number().describe("Destination board ID"),
      statusId: z.number().optional(),
      priorityId: z.number().optional(),
    },
    async (args) => {
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
    "Recalculate prices on an opportunity (refreshes from current catalog and agreement pricing).",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.post(`/sales/opportunities/${id}/recalculatePrices`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity products =====

  server.tool(
    "cw_list_opportunity_products",
    "List products on an opportunity.",
    {
      opportunityId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      opportunityId: z.number(),
      productId: z.number(),
    },
    async ({ opportunityId, productId }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/products/${productId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_opportunity_product",
    "Add a product to an opportunity.",
    {
      opportunityId: z.number().describe("Opportunity ID"),
      catalogItemId: z.number().describe("Catalog item ID"),
      quantity: z.number().describe("Quantity"),
      price: z.number().optional(),
      cost: z.number().optional(),
      priceMethod: z.string().optional().describe("MarkupCost | MarginCost | MarkupCostPercent | MarginCostPercent | OverridePrice"),
      sequenceNumber: z.number().optional(),
      description: z.string().optional(),
      billableOption: z.string().optional().describe("Billable | DoNotBill | NoCharge"),
      taxableFlag: z.boolean().optional(),
      dropshipFlag: z.boolean().optional(),
      specialOrderFlag: z.boolean().optional(),
      forecastDetailId: z.number().optional(),
    },
    async (args) => {
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
    "Update an opportunity product via JSON Patch.",
    {
      opportunityId: z.number(),
      productId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ opportunityId, productId, patch }) => {
      const result = await client.patch(`/sales/opportunities/${opportunityId}/products/${productId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity_product",
    "Remove a product from an opportunity.",
    {
      opportunityId: z.number(),
      productId: z.number(),
    },
    async ({ opportunityId, productId }) => {
      const result = await client.request("DELETE", `/sales/opportunities/${opportunityId}/products/${productId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity contacts =====

  server.tool(
    "cw_list_opportunity_contacts",
    "List contacts on an opportunity.",
    {
      opportunityId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
    "Attach a contact to an opportunity.",
    {
      opportunityId: z.number(),
      contactId: z.number(),
    },
    async ({ opportunityId, contactId }) => {
      const result = await client.post(`/sales/opportunities/${opportunityId}/contacts`, {
        id: contactId,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_remove_opportunity_contact",
    "Remove a contact from an opportunity.",
    {
      opportunityId: z.number(),
      contactId: z.number(),
    },
    async ({ opportunityId, contactId }) => {
      const result = await client.request("DELETE", `/sales/opportunities/${opportunityId}/contacts/${contactId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity notes =====

  server.tool(
    "cw_list_opportunity_notes",
    "List notes on an opportunity.",
    {
      opportunityId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      opportunityId: z.number(),
      noteId: z.number(),
    },
    async ({ opportunityId, noteId }) => {
      const result = await client.get(`/sales/opportunities/${opportunityId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_opportunity_note",
    "Add a note to an opportunity.",
    {
      opportunityId: z.number(),
      text: z.string(),
      typeId: z.number().optional(),
      flagged: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/sales/opportunities/${args.opportunityId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_opportunity_note",
    "Update an opportunity note via JSON Patch.",
    {
      opportunityId: z.number(),
      noteId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ opportunityId, noteId, patch }) => {
      const result = await client.patch(`/sales/opportunities/${opportunityId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity_note",
    "Delete an opportunity note.",
    {
      opportunityId: z.number(),
      noteId: z.number(),
    },
    async ({ opportunityId, noteId }) => {
      const result = await client.request("DELETE", `/sales/opportunities/${opportunityId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity catalog: ratings, types, statuses, note types =====

  server.tool(
    "cw_list_opportunity_ratings",
    "List opportunity ratings.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/opportunities/ratings/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_opportunity_types",
    "List opportunity types.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/opportunities/types", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_opportunity_type",
    "Get an opportunity type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/opportunities/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_opportunity_statuses",
    "List opportunity statuses.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/opportunities/statuses", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_opportunity_status",
    "Get an opportunity status.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/opportunities/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_opportunity_note_types",
    "List opportunity note types.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
