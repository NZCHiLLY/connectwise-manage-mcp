// Covers the sales surface beyond opportunities: forecasts, quotes, sales
// probabilities, opportunity statuses/types/stages, sales territories,
// rating types, sales teams, and lead-status catalog items.
//
// opportunities.ts continues to own the opportunity record itself, contacts on
// the opportunity, opportunity notes, and the opportunity-status/type/rating
// references that *attach to* an opportunity. This file owns the catalog +
// pipeline surface that sits beside it.
//
// Register this file's `registerSalesTools` in addition to the existing
// opportunities registration.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerSalesTools(server: McpServer, client: CwManageClient) {
  // ===== Forecast =====

  server.tool(
    "cw_list_sales_forecast",
    "List sales forecast rows (/sales/forecast).",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/sales/forecast", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sales_forecast",
    "Get a single forecast row.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/forecast/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Quotes =====

  server.tool(
    "cw_search_quotes",
    "Search sales quotes (/sales/quotes).",
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
      const result = await client.get("/sales/quotes", {
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
    "cw_get_quote",
    "Get a single quote by ID.",
    {
      id: z.number(),
      fields: z.string().optional(),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/sales/quotes/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_quotes",
    "Count quotes matching a conditions query.",
    {
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
    },
    async (args) => {
      const result = await client.get("/sales/quotes/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_quote",
    "Create a sales quote.",
    {
      opportunityId: z.number().optional(),
      companyId: z.number().optional(),
      contactId: z.number().optional(),
      siteId: z.number().optional(),
      statusId: z.number().optional(),
      typeId: z.number().optional(),
      name: z.string().optional(),
      number: z.string().optional(),
      expirationDate: z.string().optional(),
      issueDate: z.string().optional(),
      taxableFlag: z.boolean().optional(),
      currencyId: z.number().optional(),
      restrictDownPaymentFlag: z.boolean().optional(),
      ccEmail: z.string().optional(),
      notes: z.string().optional(),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = {};
      if (args.opportunityId !== undefined) body.opportunity = { id: args.opportunityId };
      if (args.companyId !== undefined) body.company = { id: args.companyId };
      if (args.contactId !== undefined) body.contact = { id: args.contactId };
      if (args.siteId !== undefined) body.site = { id: args.siteId };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.name) body.name = args.name;
      if (args.number) body.number = args.number;
      if (args.expirationDate) body.expirationDate = args.expirationDate;
      if (args.issueDate) body.issueDate = args.issueDate;
      if (args.taxableFlag !== undefined) body.taxableFlag = args.taxableFlag;
      if (args.currencyId !== undefined) body.currency = { id: args.currencyId };
      if (args.restrictDownPaymentFlag !== undefined) body.restrictDownPaymentFlag = args.restrictDownPaymentFlag;
      if (args.ccEmail) body.ccEmail = args.ccEmail;
      if (args.notes) body.notes = args.notes;
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/sales/quotes", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_quote",
    "Update a quote via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/quotes/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_quote",
    "Replace a quote via PUT.",
    {
      id: z.number(),
      body: z.record(z.string(), z.unknown()),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/sales/quotes/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_quote",
    "Delete a quote.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/quotes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Sales probabilities =====

  server.tool(
    "cw_list_sales_probabilities",
    "List sales probability values (used on opportunities).",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/probabilities", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sales_probability",
    "Get a sales probability.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/probabilities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_sales_probability",
    "Create a sales probability value.",
    {
      probability: z.number().describe("Percentage value (0-100)"),
    },
    async ({ probability }) => {
      const result = await client.post("/sales/probabilities", { probability });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_sales_probability",
    "Update a sales probability via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/probabilities/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_sales_probability",
    "Delete a sales probability.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/probabilities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity statuses =====

  server.tool(
    "cw_list_opportunity_statuses",
    "List opportunity statuses (/sales/opportunities/statuses).",
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
    "cw_create_opportunity_status",
    "Create an opportunity status.",
    {
      name: z.string(),
      defaultFlag: z.boolean().optional(),
      inactiveFlag: z.boolean().optional(),
      wonFlag: z.boolean().optional(),
      lostFlag: z.boolean().optional(),
      closedFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.wonFlag !== undefined) body.wonFlag = args.wonFlag;
      if (args.lostFlag !== undefined) body.lostFlag = args.lostFlag;
      if (args.closedFlag !== undefined) body.closedFlag = args.closedFlag;
      const result = await client.post("/sales/opportunities/statuses", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_opportunity_status",
    "Update an opportunity status via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/opportunities/statuses/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity_status",
    "Delete an opportunity status.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/opportunities/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity types =====

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
    "cw_create_opportunity_type",
    "Create an opportunity type.",
    {
      description: z.string(),
      inactiveFlag: z.boolean().optional(),
      integrationXref: z.string().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { description: args.description };
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.integrationXref) body.integrationXref = args.integrationXref;
      const result = await client.post("/sales/opportunities/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_opportunity_type",
    "Update an opportunity type via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/opportunities/types/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_opportunity_type",
    "Delete an opportunity type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/opportunities/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Opportunity rating types =====

  server.tool(
    "cw_list_opportunity_rating_types",
    "List opportunity rating types (e.g. Hot/Warm/Cold).",
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
    "cw_get_opportunity_rating_type",
    "Get an opportunity rating type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/opportunities/ratings/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Sales stages =====

  server.tool(
    "cw_list_sales_stages",
    "List sales pipeline stages (/sales/stages).",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/stages", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sales_stage",
    "Get a sales stage.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/stages/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_sales_stage",
    "Create a sales pipeline stage.",
    {
      name: z.string(),
      defaultFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      const result = await client.post("/sales/stages", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_sales_stage",
    "Update a sales stage via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/stages/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_sales_stage",
    "Delete a sales stage.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/stages/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Sales territories =====

  server.tool(
    "cw_list_sales_territories",
    "List sales territories.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/salesTeritories", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sales_territory",
    "Get a sales territory.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/salesTeritories/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_sales_territory",
    "Create a sales territory.",
    {
      name: z.string(),
      managerId: z.number().optional().describe("Member ID of territory manager"),
      timeZoneId: z.number().optional(),
      countryId: z.number().optional(),
      addressFormatId: z.number().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.managerId !== undefined) body.manager = { id: args.managerId };
      if (args.timeZoneId !== undefined) body.timeZone = { id: args.timeZoneId };
      if (args.countryId !== undefined) body.country = { id: args.countryId };
      if (args.addressFormatId !== undefined) body.addressFormat = { id: args.addressFormatId };
      const result = await client.post("/sales/salesTeritories", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_sales_territory",
    "Update a sales territory via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/salesTeritories/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_sales_territory",
    "Delete a sales territory.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/salesTeritories/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Sales teams =====

  server.tool(
    "cw_list_sales_teams",
    "List sales teams.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/salesTeams", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sales_team",
    "Get a sales team.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/salesTeams/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Order statuses =====

  server.tool(
    "cw_list_sales_order_statuses",
    "List sales order statuses (/sales/orders/statuses).",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/orders/statuses", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sales_order_status",
    "Get a sales order status.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/orders/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
