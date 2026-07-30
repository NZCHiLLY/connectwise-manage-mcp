import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";

export function registerScheduleTools(server: McpServer, client: CwManageClient) {
  // ── /schedule/entries ────────────────────────────────────────────────────

  server.tool(
    "cw_search_schedule_entries",
    "Search schedule entries in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"member/id = 154 and dateStart > [2026-05-01T00:00:00Z]\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/entries", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_schedule_entry",
    "Get a single schedule entry by ID.",
    {
      id: z.number().describe("Schedule entry ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/schedule/entries/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_schedule_entry",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Create a schedule entry — assigns a member to work on a ticket, project, or activity. Use scheduleTypeId=4 (Service) to assign someone to a service ticket. Dates use CW format with square brackets and Z suffix (e.g. \"[2026-05-19T09:00:00Z]\").",
    {
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      objectId: z.number().describe("ID of the linked record (ticket id, activity id, etc.)"),
      memberId: z.number().describe("Member ID to schedule"),
      scheduleTypeId: z.number().describe("Schedule type ID — 4=Service, 5=Project, 6=Sales, 7=Activity, 8=Resource, 9=Calendar (verify against /schedule/types)"),
      dateStart: z.string().describe("Start datetime in CW format: YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      dateEnd: z.string().describe("End datetime in CW format: YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      hours: z.number().optional().describe("Duration in hours"),
      ticketType: z.string().optional().describe("'ServiceTicket' or 'ProjectTicket' when objectId is a ticket"),
      statusId: z.number().optional().describe("Schedule status ID (Confirmed, Tentative, etc.)"),
      whereId: z.number().optional().describe("Location/where ID"),
      doneFlag: z.boolean().optional().describe("Mark the entry as completed"),
      acknowledgedFlag: z.boolean().optional().describe("Acknowledged by the member"),
      ownerLevel: z.string().optional().describe("Owner level"),
      allowScheduleConflictsFlag: z.boolean().optional().describe("Allow overlapping with other entries"),
      addMemberToProjectFlag: z.boolean().optional().describe("Auto-add the member to the project team"),
      projectRoleId: z.number().optional().describe("Project role ID when scheduling a project entry"),
      reminder: z.object({ id: z.number() }).optional().describe("Reminder reference"),
      notes: z.string().optional().describe("Free-text notes on the entry"),
    },
    async ({
      user_intent, user_quote,
      objectId, memberId, scheduleTypeId, dateStart, dateEnd, hours, ticketType,
      statusId, whereId, doneFlag, acknowledgedFlag, ownerLevel,
      allowScheduleConflictsFlag, addMemberToProjectFlag, projectRoleId, reminder, notes,
    }) => {
      await auditLog({ tool: "cw_create_schedule_entry", entityType: "schedule_entry", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {
        objectId,
        member: { id: memberId },
        type: { id: scheduleTypeId },
        dateStart,
        dateEnd,
      };
      if (hours !== undefined) body.hours = hours;
      if (ticketType) body.ticketType = ticketType;
      if (statusId) body.status = { id: statusId };
      if (whereId) body.where = { id: whereId };
      if (doneFlag !== undefined) body.doneFlag = doneFlag;
      if (acknowledgedFlag !== undefined) body.acknowledgedFlag = acknowledgedFlag;
      if (ownerLevel) body.ownerLevel = ownerLevel;
      if (allowScheduleConflictsFlag !== undefined) body.allowScheduleConflictsFlag = allowScheduleConflictsFlag;
      if (addMemberToProjectFlag !== undefined) body.addMemberToProjectFlag = addMemberToProjectFlag;
      if (projectRoleId) body.projectRole = { id: projectRoleId };
      if (reminder) body.reminder = reminder;
      if (notes) body.notes = notes;

      const result = await client.post("/schedule/entries", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_schedule_entry",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Update a schedule entry via JSON Patch. Common ops: replace dateStart/dateEnd, replace member/id, replace status/id.",
    {
      id: z.number().describe("Schedule entry ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, user_intent, user_quote, operations }) => {
      await auditLog({ tool: "cw_update_schedule_entry", entityType: "schedule_entry", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/schedule/entries/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_schedule_entry",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Delete a schedule entry. Optionally notify the resource via the {notifyResource} path segment.",
    {
      id: z.number().describe("Schedule entry ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      notifyResource: z.boolean().optional().describe("If provided, deletes via /schedule/entries/{id}/{notifyResource} and emails the assigned member"),
    },
    async ({ id, user_intent, user_quote, notifyResource }) => {
      await auditLog({ tool: "cw_delete_schedule_entry", entityType: "schedule_entry", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const path = notifyResource === undefined
        ? `/schedule/entries/${id}`
        : `/schedule/entries/${id}/${notifyResource}`;
      const result = await client.request("DELETE", path);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/types ──────────────────────────────────────────────────────

  server.tool(
    "cw_list_schedule_types",
    "List schedule types (Service, Project, Sales, Activity, Resource, Calendar).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/types", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_schedule_type",
    "Get a single schedule type by ID.",
    {
      id: z.number().describe("Schedule type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/schedule/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/statuses ───────────────────────────────────────────────────

  server.tool(
    "cw_list_schedule_statuses",
    "List schedule entry statuses (Confirmed, Tentative, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/statuses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_schedule_status",
    "Get a single schedule status by ID.",
    {
      id: z.number().describe("Schedule status ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/schedule/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/holidayLists  ──────────────────────────────────────────────

  server.tool(
    "cw_list_holiday_lists",
    "List holiday lists configured in CW Manage.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/holidayLists", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_holiday_list",
    "Get a single holiday list by ID.",
    {
      id: z.number().describe("Holiday list ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/schedule/holidayLists/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_holidays",
    "List holidays within a given holiday list.",
    {
      holidayListId: z.number().describe("Parent holiday list ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ holidayListId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/schedule/holidayLists/${holidayListId}/holidays`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/calendars  ─────────────────────────────────────────────────

  server.tool(
    "cw_list_calendars",
    "List working-hour calendars (which days/hours count as business hours).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/calendars", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_calendar",
    "Get a single working-hours calendar by ID.",
    {
      id: z.number().describe("Calendar ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/schedule/calendars/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_calendar",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Copy/clone a working-hours calendar. Optional 'overrides' merges onto the new calendar.",
    {
      id: z.number().describe("Source calendar ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      overrides: z.record(z.string(), z.unknown()).optional().describe("Optional Calendar fields to override on the copy"),
    },
    async ({ id, user_intent, user_quote, overrides }) => {
      await auditLog({ tool: "cw_copy_calendar", entityType: "schedule_entry", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/schedule/calendars/${id}/copy`, overrides ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/colors ─────────────────────────────────────────────────────

  server.tool(
    "cw_list_schedule_colors",
    "List the color palette for schedule entries (used for type/status color overrides).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/colors", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_clear_schedule_colors",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Clear all custom schedule colors (server-side action — destructive).",
    {
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ user_intent, user_quote }) => {
      await auditLog({ tool: "cw_clear_schedule_colors", entityType: "schedule_entry", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post("/schedule/colors/clear", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_reset_schedule_colors",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Reset schedule colors to system defaults.",
    {
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ user_intent, user_quote }) => {
      await auditLog({ tool: "cw_reset_schedule_colors", entityType: "schedule_entry", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post("/schedule/colors/reset", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/portalCalendars ────────────────────────────────────────────

  server.tool(
    "cw_list_portal_calendars",
    "List portal-facing calendar definitions (those exposed to the customer portal).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/portalCalendars", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_portal_calendar",
    "Get a single portal calendar by ID.",
    {
      id: z.number().describe("Portal calendar ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/schedule/portalCalendars/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /schedule/details ────────────────────────────────────────────────────

  server.tool(
    "cw_list_schedule_details",
    "List schedule details — sub-segments of a schedule entry (multi-day block breakdowns, sub-tasks).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/schedule/details", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
