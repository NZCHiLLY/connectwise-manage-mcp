import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerSalesTools(server: McpServer, client: CwManageClient) {
  // ── Forecasts ─────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_sales_forecast",
    "List sales forecast rows (/sales/forecast).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
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
      id: z.number().describe("Forecast row ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/forecast/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Quotes ────────────────────────────────────────────────────────────────

  server.tool(
    "cw_search_quotes",
    "Search sales quotes (/sales/quotes).",
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
      id: z.number().describe("Quote ID"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
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
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Child object conditions query string"),
      customFieldConditions: z.string().optional().describe("Custom field conditions query string"),
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
      opportunityId: z.number().optional().describe("Opportunity ID to associate the quote with"),
      companyId: z.number().optional().describe("Company ID"),
      contactId: z.number().optional().describe("Contact ID"),
      siteId: z.number().optional().describe("Site ID"),
      statusId: z.number().optional().describe("Quote status ID"),
      typeId: z.number().optional().describe("Quote type ID"),
      name: z.string().optional().describe("Quote name"),
      number: z.string().optional().describe("Quote number / reference"),
      expirationDate: z.string().optional().describe("Expiration date (ISO 8601)"),
      issueDate: z.string().optional().describe("Issue date (ISO 8601)"),
      taxableFlag: z.boolean().optional().describe("Whether the quote is taxable"),
      currencyId: z.number().optional().describe("Currency ID"),
      restrictDownPaymentFlag: z.boolean().optional().describe("Restrict down payment on this quote"),
      ccEmail: z.string().optional().describe("CC email address for quote delivery"),
      notes: z.string().optional().describe("Internal notes"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional().describe("Custom field values"),
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
      id: z.number().describe("Quote ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
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
      id: z.number().describe("Quote ID"),
      body: z.record(z.string(), z.unknown()).describe("Full replacement body for PUT"),
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
      id: z.number().describe("Quote ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/quotes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Sales Probabilities ───────────────────────────────────────────────────

  server.tool(
    "cw_list_sales_probabilities",
    "List sales probability values (used on opportunities).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Sales probability ID"),
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
      id: z.number().describe("Sales probability ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
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
      id: z.number().describe("Sales probability ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/probabilities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity Statuses ──────────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_statuses",
    "List opportunity statuses (/sales/opportunities/statuses).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Opportunity status ID"),
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
      name: z.string().describe("Status name"),
      defaultFlag: z.boolean().optional().describe("Use as the default opportunity status"),
      inactiveFlag: z.boolean().optional().describe("Mark the status inactive"),
      wonFlag: z.boolean().optional().describe("Treat this status as Won"),
      lostFlag: z.boolean().optional().describe("Treat this status as Lost"),
      closedFlag: z.boolean().optional().describe("Treat this status as Closed"),
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
      id: z.number().describe("Opportunity status ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
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
      id: z.number().describe("Opportunity status ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/opportunities/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity Types ─────────────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_types",
    "List opportunity types.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Opportunity type ID"),
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
      description: z.string().describe("Type description / label"),
      inactiveFlag: z.boolean().optional().describe("Mark the type inactive"),
      integrationXref: z.string().optional().describe("External system cross-reference identifier"),
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
      id: z.number().describe("Opportunity type ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
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
      id: z.number().describe("Opportunity type ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/opportunities/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Opportunity Rating Types ──────────────────────────────────────────────

  server.tool(
    "cw_list_opportunity_rating_types",
    "List opportunity rating types (e.g. Hot/Warm/Cold).",
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
    "cw_get_opportunity_rating_type",
    "Get an opportunity rating type.",
    {
      id: z.number().describe("Opportunity rating type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/opportunities/ratings/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Sales Stages ──────────────────────────────────────────────────────────

  server.tool(
    "cw_list_sales_stages",
    "List sales pipeline stages (/sales/stages).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Sales stage ID"),
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
      name: z.string().describe("Stage name"),
      defaultFlag: z.boolean().optional().describe("Use as the default sales stage"),
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
      id: z.number().describe("Sales stage ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
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
      id: z.number().describe("Sales stage ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/stages/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Sales Territories ─────────────────────────────────────────────────────

  server.tool(
    "cw_list_sales_territories",
    "List sales territories.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Sales territory ID"),
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
      name: z.string().describe("Territory name"),
      managerId: z.number().optional().describe("Member ID of territory manager"),
      timeZoneId: z.number().optional().describe("Time zone ID"),
      countryId: z.number().optional().describe("Country ID"),
      addressFormatId: z.number().optional().describe("Address format ID"),
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
      id: z.number().describe("Sales territory ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
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
      id: z.number().describe("Sales territory ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/salesTeritories/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Sales Teams ───────────────────────────────────────────────────────────

  server.tool(
    "cw_list_sales_teams",
    "List sales teams.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Sales team ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/salesTeams/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Order Statuses ────────────────────────────────────────────────────────

  server.tool(
    "cw_list_sales_order_statuses",
    "List sales order statuses (/sales/orders/statuses).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Sales order status ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/orders/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
