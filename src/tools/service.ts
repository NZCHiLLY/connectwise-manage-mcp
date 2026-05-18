import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";

const sentinelParams = {
  user_intent: z.string().min(20).describe(
    "Plain-English description of what the user asked for. " +
      "Must be at least 20 characters. Example: " +
      "'User asked to close ticket 12345 because they have billed it.'",
  ),
  user_quote: z.string().min(20).describe(
    "Verbatim quote of the user's actual words that motivated this action. " +
      "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
  ),
};

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerServiceTools(server: McpServer, client: CwManageClient) {
  // ── Service Boards ───────────────────────────────────────────────────────

  server.tool(
    "cw_list_service_boards",
    "List service boards.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/service/boards", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_service_board",
    "Get a single service board.",
    {
      id: z.number().describe("Service board ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/boards/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_service_board",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a service board. name and locationId are required.",
    {
      name: z.string().describe("Board name"),
      locationId: z.number().describe("Location ID the board belongs to"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      departmentId: z.number().optional().describe("Department ID"),
      inactiveFlag: z.boolean().optional().describe("Mark the board inactive"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_service_board", entityType: "service_board", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        name: args.name,
        location: { id: args.locationId },
      };
      if (args.businessUnitId !== undefined) body.businessUnit = { id: args.businessUnitId };
      if (args.departmentId !== undefined) body.department = { id: args.departmentId };
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      const result = await client.post("/service/boards", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_service_board",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a service board via JSON Patch.",
    {
      id: z.number().describe("Service board ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ id, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_service_board", entityType: "service_board", entityId: id, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/boards/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_service_board",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a service board.",
    {
      id: z.number().describe("Service board ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_service_board", entityType: "service_board", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/boards/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Board Statuses ───────────────────────────────────────────────────────

  server.tool(
    "cw_list_board_statuses",
    "List statuses on a board.",
    {
      boardId: z.number().describe("Service board ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ boardId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/boards/${boardId}/statuses`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_board_status",
    "Get a single board status.",
    {
      boardId: z.number().describe("Service board ID"),
      statusId: z.number().describe("Board status ID"),
    },
    async ({ boardId, statusId }) => {
      const result = await client.get(`/service/boards/${boardId}/statuses/${statusId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_status",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a board status.",
    {
      boardId: z.number().describe("Service board ID"),
      name: z.string().describe("Status name"),
      sortOrder: z.number().optional().describe("Display sort order"),
      defaultFlag: z.boolean().optional().describe("Use as the board default status"),
      inactiveFlag: z.boolean().optional().describe("Mark the status inactive"),
      closedFlag: z.boolean().optional().describe("Treat the status as closed"),
      escalationStatus: z.string().optional().describe("NotResponded | Responded | ResolutionPlan | NoEscalation"),
      timeEntryNotAllowedFlag: z.boolean().optional().describe("Disallow time entries while in this status"),
      displayOnBoard: z.boolean().optional().describe("Show this status on the service board view"),
      customerPortalFlag: z.boolean().optional().describe("Expose status in the customer portal"),
      customerPortalDescription: z.string().optional().describe("Customer-facing portal description"),
      roundRobinFlag: z.boolean().optional().describe("Assign tickets via round-robin when entering this status"),
      ownedByMemberFlag: z.boolean().optional().describe("Restrict edits to the owning member"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_board_status", entityType: "board_status", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.sortOrder !== undefined) body.sortOrder = args.sortOrder;
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.closedFlag !== undefined) body.closedFlag = args.closedFlag;
      if (args.escalationStatus) body.escalationStatus = args.escalationStatus;
      if (args.timeEntryNotAllowedFlag !== undefined) body.timeEntryNotAllowedFlag = args.timeEntryNotAllowedFlag;
      if (args.displayOnBoard !== undefined) body.displayOnBoard = args.displayOnBoard;
      if (args.customerPortalFlag !== undefined) body.customerPortalFlag = args.customerPortalFlag;
      if (args.customerPortalDescription) body.customerPortalDescription = args.customerPortalDescription;
      if (args.roundRobinFlag !== undefined) body.roundRobinFlag = args.roundRobinFlag;
      if (args.ownedByMemberFlag !== undefined) body.ownedByMemberFlag = args.ownedByMemberFlag;
      const result = await client.post(`/service/boards/${args.boardId}/statuses`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_board_status",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a board status via JSON Patch.",
    {
      boardId: z.number().describe("Service board ID"),
      statusId: z.number().describe("Board status ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ boardId, statusId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_board_status", entityType: "board_status", entityId: statusId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/boards/${boardId}/statuses/${statusId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_status",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a board status.",
    {
      boardId: z.number().describe("Service board ID"),
      statusId: z.number().describe("Board status ID"),
      ...sentinelParams,
    },
    async ({ boardId, statusId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_board_status", entityType: "board_status", entityId: statusId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/boards/${boardId}/statuses/${statusId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Board Types ──────────────────────────────────────────────────────────

  server.tool(
    "cw_list_board_types",
    "List ticket types under a board.",
    {
      boardId: z.number().describe("Service board ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ boardId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/boards/${boardId}/types`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_board_type",
    "Get a single board type.",
    {
      boardId: z.number().describe("Service board ID"),
      typeId: z.number().describe("Board type ID"),
    },
    async ({ boardId, typeId }) => {
      const result = await client.get(`/service/boards/${boardId}/types/${typeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a board type.",
    {
      boardId: z.number().describe("Service board ID"),
      name: z.string().describe("Type name"),
      defaultFlag: z.boolean().optional().describe("Use as the default type for the board"),
      inactiveFlag: z.boolean().optional().describe("Mark the type inactive"),
      requestForChangeFlag: z.boolean().optional().describe("Flag the type as a request-for-change"),
      categoryId: z.number().optional().describe("Service category ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_board_type", entityType: "board_type", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.requestForChangeFlag !== undefined) body.requestForChangeFlag = args.requestForChangeFlag;
      if (args.categoryId !== undefined) body.category = { id: args.categoryId };
      const result = await client.post(`/service/boards/${args.boardId}/types`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_board_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a board type via JSON Patch.",
    {
      boardId: z.number().describe("Service board ID"),
      typeId: z.number().describe("Board type ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ boardId, typeId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_board_type", entityType: "board_type", entityId: typeId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/boards/${boardId}/types/${typeId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a board type.",
    {
      boardId: z.number().describe("Service board ID"),
      typeId: z.number().describe("Board type ID"),
      ...sentinelParams,
    },
    async ({ boardId, typeId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_board_type", entityType: "board_type", entityId: typeId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/boards/${boardId}/types/${typeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Board Subtypes ───────────────────────────────────────────────────────

  server.tool(
    "cw_list_board_subtypes",
    "List subtypes on a board.",
    {
      boardId: z.number().describe("Service board ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ boardId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/boards/${boardId}/subtypes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_board_subtype",
    "Get a single board subtype.",
    {
      boardId: z.number().describe("Service board ID"),
      subTypeId: z.number().describe("Board subtype ID"),
    },
    async ({ boardId, subTypeId }) => {
      const result = await client.get(`/service/boards/${boardId}/subtypes/${subTypeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_subtype",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a board subtype.",
    {
      boardId: z.number().describe("Service board ID"),
      name: z.string().describe("Subtype name"),
      inactiveFlag: z.boolean().optional().describe("Mark the subtype inactive"),
      addAllTypesFlag: z.boolean().optional().describe("Associate the subtype with all existing types"),
      removeAllTypesFlag: z.boolean().optional().describe("Detach the subtype from all existing types"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_board_subtype", entityType: "board_subtype", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.addAllTypesFlag !== undefined) body.addAllTypesFlag = args.addAllTypesFlag;
      if (args.removeAllTypesFlag !== undefined) body.removeAllTypesFlag = args.removeAllTypesFlag;
      const result = await client.post(`/service/boards/${args.boardId}/subtypes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_board_subtype",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a board subtype via JSON Patch.",
    {
      boardId: z.number().describe("Service board ID"),
      subTypeId: z.number().describe("Board subtype ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ boardId, subTypeId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_board_subtype", entityType: "board_subtype", entityId: subTypeId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/boards/${boardId}/subtypes/${subTypeId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_subtype",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a board subtype.",
    {
      boardId: z.number().describe("Service board ID"),
      subTypeId: z.number().describe("Board subtype ID"),
      ...sentinelParams,
    },
    async ({ boardId, subTypeId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_board_subtype", entityType: "board_subtype", entityId: subTypeId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/boards/${boardId}/subtypes/${subTypeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Board Items ──────────────────────────────────────────────────────────

  server.tool(
    "cw_list_board_items",
    "List items on a board.",
    {
      boardId: z.number().describe("Service board ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ boardId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/boards/${boardId}/items`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_board_item",
    "Get a single board item.",
    {
      boardId: z.number().describe("Service board ID"),
      itemId: z.number().describe("Board item ID"),
    },
    async ({ boardId, itemId }) => {
      const result = await client.get(`/service/boards/${boardId}/items/${itemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a board item.",
    {
      boardId: z.number().describe("Service board ID"),
      name: z.string().describe("Item name"),
      inactiveFlag: z.boolean().optional().describe("Mark the item inactive"),
      categoryId: z.number().optional().describe("Service category ID"),
      subCategoryId: z.number().optional().describe("Service subcategory ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_board_item", entityType: "board_item", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.categoryId !== undefined) body.category = { id: args.categoryId };
      if (args.subCategoryId !== undefined) body.subCategory = { id: args.subCategoryId };
      const result = await client.post(`/service/boards/${args.boardId}/items`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_board_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a board item via JSON Patch.",
    {
      boardId: z.number().describe("Service board ID"),
      itemId: z.number().describe("Board item ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ boardId, itemId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_board_item", entityType: "board_item", entityId: itemId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/boards/${boardId}/items/${itemId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a board item.",
    {
      boardId: z.number().describe("Service board ID"),
      itemId: z.number().describe("Board item ID"),
      ...sentinelParams,
    },
    async ({ boardId, itemId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_board_item", entityType: "board_item", entityId: itemId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/boards/${boardId}/items/${itemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Board Teams ──────────────────────────────────────────────────────────

  server.tool(
    "cw_list_board_teams",
    "List teams on a board.",
    {
      boardId: z.number().describe("Service board ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ boardId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/boards/${boardId}/teams`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_board_team",
    "Get a single board team.",
    {
      boardId: z.number().describe("Service board ID"),
      teamId: z.number().describe("Board team ID"),
    },
    async ({ boardId, teamId }) => {
      const result = await client.get(`/service/boards/${boardId}/teams/${teamId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_team",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a board team.",
    {
      boardId: z.number().describe("Service board ID"),
      name: z.string().describe("Team name"),
      defaultFlag: z.boolean().optional().describe("Use as the default team for the board"),
      notifyOnTicketDelete: z.boolean().optional().describe("Notify the team when a ticket is deleted"),
      teamLeaderId: z.number().optional().describe("Member ID of the team leader"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      locationId: z.number().optional().describe("Location ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_board_team", entityType: "board_team", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.notifyOnTicketDelete !== undefined) body.notifyOnTicketDelete = args.notifyOnTicketDelete;
      if (args.teamLeaderId !== undefined) body.teamLeader = { id: args.teamLeaderId };
      if (args.businessUnitId !== undefined) body.businessUnit = { id: args.businessUnitId };
      if (args.locationId !== undefined) body.location = { id: args.locationId };
      const result = await client.post(`/service/boards/${args.boardId}/teams`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_board_team",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a board team via JSON Patch.",
    {
      boardId: z.number().describe("Service board ID"),
      teamId: z.number().describe("Board team ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ boardId, teamId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_board_team", entityType: "board_team", entityId: teamId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/service/boards/${boardId}/teams/${teamId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_team",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a board team.",
    {
      boardId: z.number().describe("Service board ID"),
      teamId: z.number().describe("Board team ID"),
      ...sentinelParams,
    },
    async ({ boardId, teamId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_board_team", entityType: "board_team", entityId: teamId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/service/boards/${boardId}/teams/${teamId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Priorities ───────────────────────────────────────────────────────────

  server.tool(
    "cw_list_service_priorities",
    "List service priorities.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/priorities", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_service_priority",
    "Get a single priority.",
    {
      id: z.number().describe("Service priority ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/priorities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Sources ──────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_service_sources",
    "List ticket sources.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/sources", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_service_source",
    "Get a single ticket source.",
    {
      id: z.number().describe("Ticket source ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/sources/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── SLAs ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_slas",
    "List SLAs.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/SLAs", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sla",
    "Get a single SLA.",
    {
      id: z.number().describe("SLA ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/SLAs/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_sla_priorities",
    "List per-priority SLA settings under an SLA.",
    {
      slaId: z.number().describe("SLA ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ slaId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/SLAs/${slaId}/priorities`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Impacts & Severities ─────────────────────────────────────────────────

  server.tool(
    "cw_list_impacts",
    "List impact values (Low / Medium / High).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/impacts", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_severities",
    "List severity values.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/severities", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Ticket Templates ─────────────────────────────────────────────────────

  server.tool(
    "cw_list_ticket_templates",
    "List ticket templates.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/ticketTemplates", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_ticket_template",
    "Get a ticket template.",
    {
      id: z.number().describe("Ticket template ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/ticketTemplates/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Surveys ──────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_surveys",
    "List service surveys.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/surveys", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_survey",
    "Get a single survey definition.",
    {
      id: z.number().describe("Survey ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/surveys/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_survey_results",
    "List survey results for a survey.",
    {
      surveyId: z.number().describe("Survey ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ surveyId, conditions, page, pageSize }) => {
      const result = await client.get(`/service/surveys/${surveyId}/results`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Knowledgebase ────────────────────────────────────────────────────────

  server.tool(
    "cw_list_kb_articles",
    "List knowledgebase articles.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/knowledgeBaseArticles", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_kb_article",
    "Get a knowledgebase article.",
    {
      id: z.number().describe("Knowledgebase article ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/knowledgeBaseArticles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Categories & Codes ───────────────────────────────────────────────────

  server.tool(
    "cw_list_service_categories",
    "List service categories.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/categories", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_service_category",
    "Get a service category.",
    {
      id: z.number().describe("Service category ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/categories/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_service_codes",
    "List service codes.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/service/codes", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
