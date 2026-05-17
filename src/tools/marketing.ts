import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

export function registerMarketingTools(server: McpServer, client: CwManageClient) {
  // ── /marketing/campaigns ─────────────────────────────────────────────────

  server.tool(
    "cw_search_campaigns",
    "Search marketing campaigns. Use 'conditions' for CW query syntax (e.g. \"status/name = 'Active'\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/marketing/campaigns", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_campaign",
    "Get a single marketing campaign by ID.",
    {
      id: z.number().describe("Campaign ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/marketing/campaigns/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_campaign",
    "Create a marketing campaign.",
    {
      name: z.string().describe("Campaign name"),
      typeId: z.number().describe("Campaign type ID"),
      statusId: z.number().describe("Campaign status ID"),
      subTypeId: z.number().optional().describe("Campaign sub-type ID"),
      description: z.string().optional().describe("Description"),
      startDate: z.string().optional().describe("Start date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      endDate: z.string().optional().describe("End date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      ownerId: z.number().optional().describe("Owner member ID"),
      cost: z.number().optional().describe("Budgeted cost"),
      goal: z.string().optional().describe("Campaign goal text"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      notes: z.string().optional().describe("Free-text notes"),
    },
    async ({
      name, typeId, statusId, subTypeId, description, startDate, endDate,
      ownerId, cost, goal, locationId, businessUnitId, notes,
    }) => {
      const body: Record<string, unknown> = {
        name,
        type: { id: typeId },
        status: { id: statusId },
      };
      if (subTypeId) body.subType = { id: subTypeId };
      if (description) body.description = description;
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (ownerId) body.owner = { id: ownerId };
      if (cost !== undefined) body.cost = cost;
      if (goal) body.goal = goal;
      if (locationId) body.location = { id: locationId };
      if (businessUnitId) body.businessUnit = { id: businessUnitId };
      if (notes) body.notes = notes;

      const result = await client.post("/marketing/campaigns", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_campaign",
    "Update a marketing campaign via JSON Patch.",
    {
      id: z.number().describe("Campaign ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/marketing/campaigns/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_campaign",
    "Delete a marketing campaign by ID.",
    {
      id: z.number().describe("Campaign ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/marketing/campaigns/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_campaign_audits",
    "List the audit/activity history for a campaign.",
    {
      campaignId: z.number().describe("Parent campaign ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ campaignId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/marketing/campaigns/${campaignId}/audits`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_campaign_email_messages",
    "List email messages associated with a campaign.",
    {
      campaignId: z.number().describe("Parent campaign ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ campaignId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/marketing/campaigns/${campaignId}/emailMessages`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /marketing/groups ────────────────────────────────────────────────────

  server.tool(
    "cw_search_marketing_groups",
    "Search marketing groups (segmented audience lists).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/marketing/groups", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_marketing_group",
    "Get a single marketing group by ID.",
    {
      id: z.number().describe("Group ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/marketing/groups/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_marketing_group",
    "Create a marketing group.",
    {
      name: z.string().describe("Group name"),
      groupType: z.string().describe("Group type ('Contact' or 'Company')"),
      description: z.string().optional().describe("Description"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
    },
    async ({ name, groupType, description, locationId, businessUnitId }) => {
      const body: Record<string, unknown> = { name, groupType };
      if (description) body.description = description;
      if (locationId) body.location = { id: locationId };
      if (businessUnitId) body.businessUnit = { id: businessUnitId };

      const result = await client.post("/marketing/groups", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_marketing_group",
    "Update a marketing group via JSON Patch.",
    {
      id: z.number().describe("Group ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/marketing/groups/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_marketing_group",
    "Delete a marketing group by ID.",
    {
      id: z.number().describe("Group ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/marketing/groups/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /marketing/groups/{id}/companies (audience membership) ───────────────

  server.tool(
    "cw_list_marketing_group_companies",
    "List company members of a marketing group.",
    {
      groupId: z.number().describe("Parent group ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ groupId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/marketing/groups/${groupId}/companies`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_marketing_group_contacts",
    "List contact members of a marketing group.",
    {
      groupId: z.number().describe("Parent group ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ groupId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/marketing/groups/${groupId}/contacts`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /marketing/campaigns/{id}/optOut ─────────────────────────────────────

  server.tool(
    "cw_list_campaign_opt_outs",
    "List opt-outs for a campaign (contacts who unsubscribed).",
    {
      campaignId: z.number().describe("Parent campaign ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ campaignId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/marketing/campaigns/${campaignId}/optOut`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /marketing/campaignTypes ─────────────────────────────────────────────

  server.tool(
    "cw_list_campaign_types",
    "List campaign type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/marketing/campaigns/types", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_campaign_type",
    "Get a single campaign type by ID.",
    {
      id: z.number().describe("Campaign type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/marketing/campaigns/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_campaign_sub_types",
    "List campaign sub-type definitions for a parent type.",
    {
      typeId: z.number().describe("Parent campaign type ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ typeId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/marketing/campaigns/types/${typeId}/subTypes`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /marketing/campaignStatuses ──────────────────────────────────────────

  server.tool(
    "cw_list_campaign_statuses",
    "List campaign status definitions (Active, Planning, Completed, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/marketing/campaigns/statuses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_campaign_status",
    "Get a single campaign status by ID.",
    {
      id: z.number().describe("Campaign status ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/marketing/campaigns/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
