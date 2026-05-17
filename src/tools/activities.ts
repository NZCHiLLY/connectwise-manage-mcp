import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerActivityTools(server: McpServer, client: CwManageClient) {
  // ── Core Activities ──────────────────────────────────────────────────────

  server.tool(
    "cw_search_activities",
    "Search CRM activities. Use 'conditions' for CW query syntax.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Conditions applied to child collections"),
      customFieldConditions: z.string().optional().describe("Conditions applied to custom fields"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    },
    async ({ conditions, childConditions, customFieldConditions, page, pageSize, orderBy, fields }) => {
      const result = await client.get("/sales/activities", {
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
    "cw_get_activity",
    "Get a single activity by ID.",
    {
      id: z.number().describe("Activity ID"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/sales/activities/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_activities",
    "Count activities matching a conditions query.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Conditions applied to child collections"),
      customFieldConditions: z.string().optional().describe("Conditions applied to custom fields"),
    },
    async (args) => {
      const result = await client.get("/sales/activities/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_activity",
    "Create a CRM activity. name and assignToId are required.",
    {
      name: z.string().describe("Activity name (required)"),
      assignToId: z.number().describe("Member ID activity is assigned to"),
      typeId: z.number().optional().describe("Activity type ID"),
      statusId: z.number().optional().describe("Activity status ID"),
      companyId: z.number().optional().describe("Company ID"),
      contactId: z.number().optional().describe("Contact ID"),
      opportunityId: z.number().optional().describe("Opportunity ID"),
      ticketId: z.number().optional().describe("Ticket ID"),
      campaignId: z.number().optional().describe("Campaign ID"),
      agreementId: z.number().optional().describe("Agreement ID"),
      notes: z.string().optional().describe("Activity notes / detail"),
      dateStart: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      dateEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      allDayFlag: z.boolean().optional().describe("True if the activity spans the full day"),
      mobileGuid: z.string().optional().describe("Mobile GUID for client-generated activities"),
      where: z.string().optional().describe("Location"),
      reminderId: z.number().optional().describe("Reminder ID"),
      priorityId: z.number().optional().describe("Priority ID"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional().describe("Custom field values"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        name: args.name,
        assignTo: { id: args.assignToId },
      };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.companyId !== undefined) body.company = { id: args.companyId };
      if (args.contactId !== undefined) body.contact = { id: args.contactId };
      if (args.opportunityId !== undefined) body.opportunity = { id: args.opportunityId };
      if (args.ticketId !== undefined) body.ticket = { id: args.ticketId };
      if (args.campaignId !== undefined) body.campaign = { id: args.campaignId };
      if (args.agreementId !== undefined) body.agreement = { id: args.agreementId };
      if (args.notes) body.notes = args.notes;
      if (args.dateStart) body.dateStart = args.dateStart;
      if (args.dateEnd) body.dateEnd = args.dateEnd;
      if (args.allDayFlag !== undefined) body.allDayFlag = args.allDayFlag;
      if (args.mobileGuid) body.mobileGuid = args.mobileGuid;
      if (args.where) body.where = args.where;
      if (args.reminderId !== undefined) body.reminder = { id: args.reminderId };
      if (args.priorityId !== undefined) body.priority = { id: args.priorityId };
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/sales/activities", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_activity",
    "Update an activity via JSON Patch.",
    {
      id: z.number().describe("Activity ID"),
      patch: z.array(patchOp).describe("JSON Patch operations"),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/activities/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_activity",
    "Replace an activity via PUT.",
    {
      id: z.number().describe("Activity ID"),
      body: z.record(z.string(), z.unknown()).describe("Full replacement body for PUT"),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/sales/activities/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_activity",
    "Delete an activity.",
    {
      id: z.number().describe("Activity ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/activities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Activity Notes ───────────────────────────────────────────────────────
  // Some CW versions expose /sales/activities/{id}/notes.

  server.tool(
    "cw_list_activity_notes",
    "List notes on an activity.",
    {
      activityId: z.number().describe("Activity ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ activityId, conditions, page, pageSize }) => {
      const result = await client.get(`/sales/activities/${activityId}/notes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_activity_note",
    "Add a note to an activity.",
    {
      activityId: z.number().describe("Activity ID"),
      text: z.string().describe("Note text"),
      flagged: z.boolean().optional().describe("Flag the note as important"),
    },
    async (args) => {
      const body: Record<string, unknown> = { text: args.text };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/sales/activities/${args.activityId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Stopwatches ──────────────────────────────────────────────────────────

  server.tool(
    "cw_list_activity_stopwatches",
    "List stop-watches recorded against an activity.",
    {
      activityId: z.number().describe("Activity ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ activityId, conditions, page, pageSize }) => {
      const result = await client.get(`/sales/activities/${activityId}/stopwatches`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Activity Types ───────────────────────────────────────────────────────

  server.tool(
    "cw_list_activity_types",
    "List activity types.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/activities/types", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_activity_type",
    "Get an activity type.",
    {
      id: z.number().describe("Activity type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/activities/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_activity_type",
    "Create an activity type.",
    {
      name: z.string().describe("Activity type name"),
      points: z.number().optional().describe("Sales-points value for activities of this type"),
      defaultFlag: z.boolean().optional().describe("Mark as default activity type"),
      emailFlag: z.boolean().optional().describe("Enable email integration for this type"),
      memoFlag: z.boolean().optional().describe("Enable memo behaviour for this type"),
      historyFlag: z.boolean().optional().describe("Record this type in activity history"),
      inactiveFlag: z.boolean().optional().describe("Mark the type as inactive"),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.points !== undefined) body.points = args.points;
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.emailFlag !== undefined) body.emailFlag = args.emailFlag;
      if (args.memoFlag !== undefined) body.memoFlag = args.memoFlag;
      if (args.historyFlag !== undefined) body.historyFlag = args.historyFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      const result = await client.post("/sales/activities/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_activity_type",
    "Update an activity type via JSON Patch.",
    {
      id: z.number().describe("Activity type ID"),
      patch: z.array(patchOp).describe("JSON Patch operations"),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/activities/types/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_activity_type",
    "Delete an activity type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/activities/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Activity statuses =====

  server.tool(
    "cw_list_activity_statuses",
    "List activity statuses.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/sales/activities/statuses", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_activity_status",
    "Get an activity status.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/sales/activities/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_activity_status",
    "Create an activity status.",
    {
      name: z.string(),
      defaultFlag: z.boolean().optional(),
      inactiveFlag: z.boolean().optional(),
      spawnFollowupFlag: z.boolean().optional(),
      closedFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.spawnFollowupFlag !== undefined) body.spawnFollowupFlag = args.spawnFollowupFlag;
      if (args.closedFlag !== undefined) body.closedFlag = args.closedFlag;
      const result = await client.post("/sales/activities/statuses", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_activity_status",
    "Update an activity status via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/sales/activities/statuses/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_activity_status",
    "Delete an activity status.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/sales/activities/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
