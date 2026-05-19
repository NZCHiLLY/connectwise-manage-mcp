import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";
import { patchOp } from "./shared.js";

export function registerTicketTools(server: McpServer, client: CwManageClient) {
  // ── Core Ticket CRUD ─────────────────────────────────────────────────────

  server.tool(
    "cw_search_tickets",
    "Search service tickets. Use 'conditions' for CW query syntax (e.g. \"status/name='New' and board/name='Service'\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Filter on child collections"),
      customFieldConditions: z.string().optional().describe("Filter on custom fields"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
      fields: z.string().optional().describe("Comma-separated fields to return"),
    },
    async ({ conditions, childConditions, customFieldConditions, page, pageSize, orderBy, fields }) => {
      const result = await client.get("/service/tickets", {
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
    "cw_get_ticket",
    "Get a single service ticket by ID.",
    {
      id: z.number().describe("Ticket ID"),
      fields: z.string().optional().describe("Comma-separated fields to return"),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/service/tickets/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_ticket_by_id_search",
    "Lookup a ticket by ID via the /service/tickets/search endpoint (POST with id payload). Useful when you have only a ticket number and want the search-endpoint shape.",
    {
      id: z.number().describe("Ticket ID to look up"),
    },
    async ({ id }) => {
      const result = await client.post("/service/tickets/search", { id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a new service ticket. summary is required; either company or contact is normally required.",
    {
      summary: z.string().describe("Ticket summary / title (required)"),
      boardId: z.number().optional().describe("Service board ID"),
      statusId: z.number().optional().describe("Status ID"),
      companyId: z.number().optional().describe("Company ID"),
      contactId: z.number().optional().describe("Contact ID"),
      siteId: z.number().optional().describe("Site ID"),
      typeId: z.number().optional().describe("Ticket type ID"),
      subTypeId: z.number().optional().describe("Ticket subtype ID"),
      itemId: z.number().optional().describe("Ticket item ID"),
      priorityId: z.number().optional().describe("Priority ID"),
      severityId: z.number().optional().describe("Severity ID (Low/Medium/High)"),
      impactId: z.number().optional().describe("Impact ID (Low/Medium/High)"),
      sourceId: z.number().optional().describe("Source ID"),
      agreementId: z.number().optional().describe("Agreement ID"),
      ownerId: z.number().optional().describe("Owner (member) ID"),
      teamId: z.number().optional().describe("Team ID"),
      slaId: z.number().optional().describe("SLA ID"),
      locationId: z.number().optional().describe("Location ID"),
      departmentId: z.number().optional().describe("Department ID"),
      initialDescription: z.string().optional().describe("Initial description (private note will not be created)"),
      initialInternalAnalysis: z.string().optional().describe("Initial internal analysis note"),
      initialResolution: z.string().optional().describe("Initial resolution note"),
      initialDescriptionFrom: z.string().optional().describe("Sender of initial description"),
      billTime: z.string().optional().describe("Bill time setting: NoDefault, Billable, DoNotBill, NoCharge"),
      billExpenses: z.string().optional().describe("Bill expenses setting"),
      billProducts: z.string().optional().describe("Bill products setting"),
      automaticEmailContactFlag: z.boolean().optional().describe("Send automatic email to the contact"),
      automaticEmailResourceFlag: z.boolean().optional().describe("Send automatic email to assigned resources"),
      automaticEmailCcFlag: z.boolean().optional().describe("Send automatic email to CC addresses"),
      automaticEmailCc: z.string().optional().describe("Email addresses to CC automatically"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional()
        .describe("Custom field values: [{id, value}]"),
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
    async (args) => {
      await auditLog({ tool: "cw_create_ticket", entityType: "ticket", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { summary: args.summary };
      if (args.boardId !== undefined) body.board = { id: args.boardId };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.companyId !== undefined) body.company = { id: args.companyId };
      if (args.contactId !== undefined) body.contact = { id: args.contactId };
      if (args.siteId !== undefined) body.site = { id: args.siteId };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.subTypeId !== undefined) body.subType = { id: args.subTypeId };
      if (args.itemId !== undefined) body.item = { id: args.itemId };
      if (args.priorityId !== undefined) body.priority = { id: args.priorityId };
      if (args.severityId !== undefined) body.severity = { id: args.severityId };
      if (args.impactId !== undefined) body.impact = { id: args.impactId };
      if (args.sourceId !== undefined) body.source = { id: args.sourceId };
      if (args.agreementId !== undefined) body.agreement = { id: args.agreementId };
      if (args.ownerId !== undefined) body.owner = { id: args.ownerId };
      if (args.teamId !== undefined) body.team = { id: args.teamId };
      if (args.slaId !== undefined) body.sla = { id: args.slaId };
      if (args.locationId !== undefined) body.location = { id: args.locationId };
      if (args.departmentId !== undefined) body.department = { id: args.departmentId };
      if (args.initialDescription) body.initialDescription = args.initialDescription;
      if (args.initialInternalAnalysis) body.initialInternalAnalysis = args.initialInternalAnalysis;
      if (args.initialResolution) body.initialResolution = args.initialResolution;
      if (args.initialDescriptionFrom) body.initialDescriptionFrom = args.initialDescriptionFrom;
      if (args.billTime) body.billTime = args.billTime;
      if (args.billExpenses) body.billExpenses = args.billExpenses;
      if (args.billProducts) body.billProducts = args.billProducts;
      if (args.automaticEmailContactFlag !== undefined) body.automaticEmailContactFlag = args.automaticEmailContactFlag;
      if (args.automaticEmailResourceFlag !== undefined) body.automaticEmailResourceFlag = args.automaticEmailResourceFlag;
      if (args.automaticEmailCcFlag !== undefined) body.automaticEmailCcFlag = args.automaticEmailCcFlag;
      if (args.automaticEmailCc) body.automaticEmailCc = args.automaticEmailCc;
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/service/tickets", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Update one or more fields on a service ticket. Supply only the fields you want to change.",
    {
      id: z.number().describe("Ticket ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(1).describe(
        "Verbatim quote of the user's actual words that motivated this update. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      summary: z.string().optional().describe("New ticket summary / title"),
      statusId: z.number().optional().describe("New status ID (use cw_list_board_statuses to find valid IDs)"),
      priorityId: z.number().optional().describe("New priority ID (use cw_list_service_priorities)"),
      boardId: z.number().optional().describe("New service board ID (use cw_list_service_boards)"),
      typeId: z.number().optional().describe("New ticket type ID"),
      subTypeId: z.number().optional().describe("New ticket sub-type ID"),
      itemId: z.number().optional().describe("New board item ID"),
      ownerId: z.number().optional().describe("Member ID to assign as owner"),
      teamId: z.number().optional().describe("Team ID"),
      contactId: z.number().optional().describe("Contact ID"),
      companyId: z.number().optional().describe("Company ID"),
      siteId: z.number().optional().describe("Site ID"),
      requiredDate: z.string().optional().describe("Due date in ISO 8601 format, e.g. '2025-06-30T00:00:00Z'"),
    },
    async ({ id, user_intent, user_quote, ...fields }) => {
      const ops: { op: string; path: string; value: unknown }[] = [];
      if (fields.summary !== undefined)     ops.push({ op: "replace", path: "/summary",      value: fields.summary });
      if (fields.statusId !== undefined)    ops.push({ op: "replace", path: "/status/id",    value: fields.statusId });
      if (fields.priorityId !== undefined)  ops.push({ op: "replace", path: "/priority/id",  value: fields.priorityId });
      if (fields.boardId !== undefined)     ops.push({ op: "replace", path: "/board/id",     value: fields.boardId });
      if (fields.typeId !== undefined)      ops.push({ op: "replace", path: "/type/id",      value: fields.typeId });
      if (fields.subTypeId !== undefined)   ops.push({ op: "replace", path: "/subType/id",   value: fields.subTypeId });
      if (fields.itemId !== undefined)      ops.push({ op: "replace", path: "/item/id",      value: fields.itemId });
      if (fields.ownerId !== undefined)     ops.push({ op: "replace", path: "/owner/id",     value: fields.ownerId });
      if (fields.teamId !== undefined)      ops.push({ op: "replace", path: "/team/id",      value: fields.teamId });
      if (fields.contactId !== undefined)   ops.push({ op: "replace", path: "/contact/id",   value: fields.contactId });
      if (fields.companyId !== undefined)   ops.push({ op: "replace", path: "/company/id",   value: fields.companyId });
      if (fields.siteId !== undefined)      ops.push({ op: "replace", path: "/site/id",      value: fields.siteId });
      if (fields.requiredDate !== undefined) ops.push({ op: "replace", path: "/requiredDate", value: fields.requiredDate });
      if (ops.length === 0) {
        return { content: [{ type: "text", text: "cw_update_ticket: no fields to update were provided. Specify at least one of: summary, statusId, priorityId, boardId, typeId, subTypeId, itemId, ownerId, teamId, contactId, companyId, siteId, requiredDate." }], isError: true };
      }
      await auditLog({ tool: "cw_update_ticket", entityType: "ticket", entityId: id, userIntent: user_intent, userQuote: user_quote, operations: ops });
      const result = await client.patch(`/service/tickets/${id}`, ops);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Replace a service ticket via PUT. Sends the full ticket body — use cw_update_ticket for partial changes.",
    {
      id: z.number().describe("Ticket ID"),
      body: z.record(z.string(), z.unknown()).describe("Full ticket body for PUT replacement"),
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
    async ({ id, body, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_replace_ticket", entityType: "ticket", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.put(`/service/tickets/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a service ticket. Destructive — ticket history may be retained but the ticket record is removed.",
    {
      id: z.number().describe("Ticket ID"),
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
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_ticket", entityType: "ticket", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/tickets/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_tickets",
    "Count service tickets matching a conditions query (returns {count}).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Filter on child collections"),
      customFieldConditions: z.string().optional().describe("Filter on custom fields"),
    },
    async (args) => {
      const result = await client.get("/service/tickets/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Copy an existing ticket to a new ticket. Returns the new ticket.",
    {
      id: z.number().describe("Source ticket ID"),
      summary: z.string().optional().describe("Override summary on the copy"),
      boardId: z.number().optional().describe("Override board on the copy"),
      statusId: z.number().optional().describe("Override status on the copy"),
      includeNotesFlag: z.boolean().optional().describe("Copy notes to the new ticket"),
      includeTasksFlag: z.boolean().optional().describe("Copy tasks to the new ticket"),
      includeDocumentsFlag: z.boolean().optional().describe("Copy documents to the new ticket"),
      includeProductsFlag: z.boolean().optional().describe("Copy products to the new ticket"),
      includeAllNotesFlag: z.boolean().optional().describe("Copy all notes (including internal) to the new ticket"),
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
    async (args) => {
      await auditLog({ tool: "cw_copy_ticket", entityType: "ticket", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {};
      if (args.summary) body.summary = args.summary;
      if (args.boardId !== undefined) body.board = { id: args.boardId };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.includeNotesFlag !== undefined) body.includeNotesFlag = args.includeNotesFlag;
      if (args.includeTasksFlag !== undefined) body.includeTasksFlag = args.includeTasksFlag;
      if (args.includeDocumentsFlag !== undefined) body.includeDocumentsFlag = args.includeDocumentsFlag;
      if (args.includeProductsFlag !== undefined) body.includeProductsFlag = args.includeProductsFlag;
      if (args.includeAllNotesFlag !== undefined) body.includeAllNotesFlag = args.includeAllNotesFlag;
      const result = await client.post(`/service/tickets/${args.id}/copy`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_merge_tickets",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Merge one or more source tickets into a target ticket. Source tickets are closed and their notes/time/products move to the target.",
    {
      targetTicketId: z.number().describe("Surviving ticket ID"),
      mergeTicketIds: z.array(z.number()).describe("IDs of tickets to merge into the target"),
      statusId: z.number().optional().describe("Status to apply to closed source tickets"),
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
    async ({ targetTicketId, mergeTicketIds, statusId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_merge_tickets", entityType: "ticket", entityId: targetTicketId, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {
        mergeTicketIds: mergeTicketIds.map((id) => ({ id })),
      };
      if (statusId !== undefined) body.status = { id: statusId };
      const result = await client.post(`/service/tickets/${targetTicketId}/merge`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_convert_ticket_from_survey",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Convert a survey response into a service ticket via /service/tickets/{id}/convertFromSurvey.",
    {
      id: z.number().describe("Source survey ticket ID"),
      boardId: z.number().optional().describe("Destination board"),
      statusId: z.number().optional().describe("Destination status"),
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
    async ({ id, boardId, statusId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_convert_ticket_from_survey", entityType: "ticket", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {};
      if (boardId !== undefined) body.board = { id: boardId };
      if (statusId !== undefined) body.status = { id: statusId };
      const result = await client.post(`/service/tickets/${id}/convertFromSurvey`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Notes ─────────────────────────────────────────────────────────

  server.tool(
    "cw_get_ticket_notes",
    "Get notes on a service ticket. Tries /allNotes first (includes child-ticket notes); falls back to /notes on older CWM versions. Supports conditions and orderBy for filtering.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      orderBy: z.string().optional().describe("Field to order by"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ ticketId, conditions, orderBy, page, pageSize }) => {
      try {
        const result = await client.get(`/service/tickets/${ticketId}/allNotes`, {
          conditions,
          orderBy,
          page: page ?? 1,
          pageSize: pageSize ?? 25,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("404") || msg.includes("405")) {
          // allNotes not supported on this CWM version — fall back to /notes
          const result = await client.get(`/service/tickets/${ticketId}/notes`, {
            conditions,
            orderBy,
            page: page ?? 1,
            pageSize: pageSize ?? 25,
          });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        throw err;
      }
    },
  );

  server.tool(
    "cw_get_ticket_note",
    "Get a single ticket note.",
    {
      ticketId: z.number().describe("Ticket ID"),
      noteId: z.number().describe("Note ID"),
    },
    async ({ ticketId, noteId }) => {
      const result = await client.get(`/service/tickets/${ticketId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_ticket_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a note to a service ticket. Use detailDescriptionFlag for a description note, internalAnalysisFlag for an internal-only note, or resolutionFlag for a resolution note. Defaults to a plain discussion note visible to the customer.",
    {
      ticketId: z.number().describe("Ticket ID"),
      text: z.string().describe("Note text content"),
      detailDescriptionFlag: z.boolean().optional().describe("Add as detail description (default: false)"),
      internalAnalysisFlag: z.boolean().optional().describe("Mark as internal analysis only (default: false)"),
      resolutionFlag: z.boolean().optional().describe("Mark as resolution note (default: false)"),
      customerUpdatedFlag: z.boolean().optional().describe("Flag that the customer was updated (default: false)"),
      processNotifications: z.boolean().optional().describe("Trigger workflow / email notifications"),
      memberId: z.number().optional().describe("Member who authored the note"),
      contactId: z.number().optional().describe("Contact who authored the note (if not a member)"),
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
    async ({ ticketId, text, detailDescriptionFlag, internalAnalysisFlag, resolutionFlag, customerUpdatedFlag, processNotifications, memberId, contactId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_add_ticket_note", entityType: "ticket_note", entityId: ticketId, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { text };
      if (detailDescriptionFlag !== undefined) body.detailDescriptionFlag = detailDescriptionFlag;
      if (internalAnalysisFlag !== undefined) body.internalAnalysisFlag = internalAnalysisFlag;
      if (resolutionFlag !== undefined) body.resolutionFlag = resolutionFlag;
      if (customerUpdatedFlag !== undefined) body.customerUpdatedFlag = customerUpdatedFlag;
      if (processNotifications !== undefined) body.processNotifications = processNotifications;
      if (memberId !== undefined) body.member = { id: memberId };
      if (contactId !== undefined) body.contact = { id: contactId };
      const result = await client.post(`/service/tickets/${ticketId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_ticket_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a ticket note via JSON Patch.",
    {
      ticketId: z.number().describe("Ticket ID"),
      noteId: z.number().describe("Note ID"),
      patch: z.array(patchOp).describe("Array of JSON Patch operations"),
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
    async ({ ticketId, noteId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_ticket_note", entityType: "ticket_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/tickets/${ticketId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_ticket_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a ticket note.",
    {
      ticketId: z.number().describe("Ticket ID"),
      noteId: z.number().describe("Note ID"),
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
    async ({ ticketId, noteId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_ticket_note", entityType: "ticket_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/tickets/${ticketId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Tasks ─────────────────────────────────────────────────────────

  server.tool(
    "cw_list_ticket_tasks",
    "List tasks (checklist items) on a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ ticketId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/service/tickets/${ticketId}/tasks`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_ticket_task",
    "Get a single ticket task by ID.",
    {
      ticketId: z.number().describe("Ticket ID"),
      taskId: z.number().describe("Task ID"),
    },
    async ({ ticketId, taskId }) => {
      const result = await client.get(`/service/tickets/${ticketId}/tasks/${taskId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_ticket_task",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a task / checklist item on a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      notes: z.string().describe("Task notes / description"),
      closedFlag: z.boolean().optional().describe("Already completed?"),
      priority: z.number().optional().describe("Display priority / ordering"),
      scheduleId: z.number().optional().describe("Linked schedule entry"),
      resolution: z.string().optional().describe("Resolution text for the task"),
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
    async (args) => {
      await auditLog({ tool: "cw_create_ticket_task", entityType: "ticket_task", entityId: args.ticketId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { notes: args.notes };
      if (args.closedFlag !== undefined) body.closedFlag = args.closedFlag;
      if (args.priority !== undefined) body.priority = args.priority;
      if (args.scheduleId !== undefined) body.schedule = { id: args.scheduleId };
      if (args.resolution) body.resolution = args.resolution;
      const result = await client.post(`/service/tickets/${args.ticketId}/tasks`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_ticket_task",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a ticket task via JSON Patch (typical use: /closedFlag = true to tick a checkbox).",
    {
      ticketId: z.number().describe("Ticket ID"),
      taskId: z.number().describe("Task ID"),
      patch: z.array(patchOp).describe("Array of JSON Patch operations"),
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
    async ({ ticketId, taskId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_ticket_task", entityType: "ticket_task", entityId: taskId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/tickets/${ticketId}/tasks/${taskId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_ticket_task",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a ticket task.",
    {
      ticketId: z.number().describe("Ticket ID"),
      taskId: z.number().describe("Task ID"),
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
    async ({ ticketId, taskId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_ticket_task", entityType: "ticket_task", entityId: taskId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/tickets/${ticketId}/tasks/${taskId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Team Members ──────────────────────────────────────────────────

  server.tool(
    "cw_list_ticket_team",
    "List team members assigned to a ticket via /service/tickets/{id}/allTeamMembers (returns owner + sub-team).",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ ticketId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/tickets/${ticketId}/allTeamMembers`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_ticket_team_member",
    "Get a single team-member assignment on a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      teamMemberId: z.number().describe("Team-member assignment ID (NOT the member ID)"),
    },
    async ({ ticketId, teamMemberId }) => {
      const result = await client.get(`/service/tickets/${ticketId}/allTeamMembers/${teamMemberId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_ticket_team_member",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a member to a ticket's sub-team.",
    {
      ticketId: z.number().describe("Ticket ID"),
      memberId: z.number().describe("Member ID to add"),
      teamRoleId: z.number().optional().describe("Team role ID"),
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
    async ({ ticketId, memberId, teamRoleId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_add_ticket_team_member", entityType: "ticket_team_member", entityId: ticketId, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { member: { id: memberId } };
      if (teamRoleId !== undefined) body.teamRole = { id: teamRoleId };
      const result = await client.post(`/service/tickets/${ticketId}/allTeamMembers`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_ticket_team_member",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a team-member assignment (e.g. change team role) via JSON Patch.",
    {
      ticketId: z.number().describe("Ticket ID"),
      teamMemberId: z.number().describe("Team-member assignment ID"),
      patch: z.array(patchOp).describe("Array of JSON Patch operations"),
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
    async ({ ticketId, teamMemberId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_ticket_team_member", entityType: "ticket_team_member", entityId: teamMemberId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/tickets/${ticketId}/allTeamMembers/${teamMemberId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_remove_ticket_team_member",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a member from a ticket's sub-team.",
    {
      ticketId: z.number().describe("Ticket ID"),
      teamMemberId: z.number().describe("Team-member assignment ID"),
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
    async ({ ticketId, teamMemberId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_remove_ticket_team_member", entityType: "ticket_team_member", entityId: teamMemberId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/tickets/${ticketId}/allTeamMembers/${teamMemberId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Products ──────────────────────────────────────────────────────

  server.tool(
    "cw_list_ticket_products",
    "List products attached to a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ ticketId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/tickets/${ticketId}/products`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Configurations ────────────────────────────────────────────────

  server.tool(
    "cw_list_ticket_configurations",
    "List configurations (assets) attached to a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ ticketId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/tickets/${ticketId}/configurations`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_attach_configuration_to_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Attach a configuration (asset) to a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      configurationId: z.number().describe("Configuration ID to attach"),
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
    async ({ ticketId, configurationId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_attach_configuration_to_ticket", entityType: "ticket_configuration", entityId: configurationId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/service/tickets/${ticketId}/configurations`, {
        id: configurationId,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_detach_configuration_from_ticket",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Detach a configuration from a ticket.",
    {
      ticketId: z.number().describe("Ticket ID"),
      configurationId: z.number().describe("Configuration ID to detach"),
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
    async ({ ticketId, configurationId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_detach_configuration_from_ticket", entityType: "ticket_configuration", entityId: configurationId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/tickets/${ticketId}/configurations/${configurationId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Documents ─────────────────────────────────────────────────────

  server.tool(
    "cw_list_ticket_documents",
    "List documents attached to a ticket via /service/tickets/{id}/documents.",
    {
      ticketId: z.number().describe("Ticket ID"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ ticketId, page, pageSize }) => {
      const result = await client.get(`/service/tickets/${ticketId}/documents`, {
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Per-ticket time / schedule / activities =====

  server.tool(
    "cw_list_ticket_time_entries",
    "List time entries against a ticket via /service/tickets/{id}/timeentries.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
    },
    async ({ ticketId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/service/tickets/${ticketId}/timeentries`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_ticket_schedule_entries",
    "List schedule entries (appointments) linked to a ticket via /service/tickets/{id}/scheduleentries.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ ticketId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/tickets/${ticketId}/scheduleentries`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_ticket_activities",
    "List CRM activities linked to a ticket via /service/tickets/{id}/activities.",
    {
      ticketId: z.number().describe("Ticket ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ ticketId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/tickets/${ticketId}/activities`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Sentinel L1: schedule-entry member assignment =====

  server.tool(
    "cw_add_ticket_member",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a member (resource) to a service ticket by creating a schedule entry assignment.",
    {
      id: z.number().describe("Ticket ID"),
      memberIdentifier: z.string().describe("Member username/identifier to assign (e.g. 'jsmith')"),
      scheduleTypeId: z.number().optional().describe(
        "Schedule entry type ID for service tickets (default: 4). Verify against GET /schedule/types for your CWM instance — IDs are instance-specific.",
      ),
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
    async ({ id, memberIdentifier, scheduleTypeId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_add_ticket_member", entityType: "ticket_member", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/schedule/entries`, {
        type: { id: scheduleTypeId ?? 4 },
        objectId: id,
        member: { identifier: memberIdentifier },
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
