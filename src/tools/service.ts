import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerServiceTools(server: McpServer, client: CwManageClient) {
  // ===== Service boards =====

  server.tool(
    "cw_list_service_boards",
    "List service boards.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
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
      id: z.number().describe("Board ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/service/boards/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_service_board",
    "Create a service board. name and locationId are required.",
    {
      name: z.string(),
      locationId: z.number(),
      businessUnitId: z.number().optional(),
      departmentId: z.number().optional(),
      inactiveFlag: z.boolean().optional(),
    },
    async (args) => {
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
    "Update a service board via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/service/boards/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_service_board",
    "Delete a service board.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/service/boards/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Board statuses =====

  server.tool(
    "cw_list_board_statuses",
    "List statuses on a board.",
    {
      boardId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      boardId: z.number(),
      statusId: z.number(),
    },
    async ({ boardId, statusId }) => {
      const result = await client.get(`/service/boards/${boardId}/statuses/${statusId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_status",
    "Create a board status.",
    {
      boardId: z.number(),
      name: z.string(),
      sortOrder: z.number().optional(),
      defaultFlag: z.boolean().optional(),
      inactiveFlag: z.boolean().optional(),
      closedFlag: z.boolean().optional(),
      escalationStatus: z.string().optional().describe("NotResponded | Responded | ResolutionPlan | NoEscalation"),
      timeEntryNotAllowedFlag: z.boolean().optional(),
      displayOnBoard: z.boolean().optional(),
      customerPortalFlag: z.boolean().optional(),
      customerPortalDescription: z.string().optional(),
      roundRobinFlag: z.boolean().optional(),
      ownedByMemberFlag: z.boolean().optional(),
    },
    async (args) => {
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
    "Update a board status via JSON Patch.",
    {
      boardId: z.number(),
      statusId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ boardId, statusId, patch }) => {
      const result = await client.patch(`/service/boards/${boardId}/statuses/${statusId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_status",
    "Delete a board status.",
    {
      boardId: z.number(),
      statusId: z.number(),
    },
    async ({ boardId, statusId }) => {
      const result = await client.request("DELETE", `/service/boards/${boardId}/statuses/${statusId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Board types =====

  server.tool(
    "cw_list_board_types",
    "List ticket types under a board.",
    {
      boardId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      boardId: z.number(),
      typeId: z.number(),
    },
    async ({ boardId, typeId }) => {
      const result = await client.get(`/service/boards/${boardId}/types/${typeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_type",
    "Create a board type.",
    {
      boardId: z.number(),
      name: z.string(),
      defaultFlag: z.boolean().optional(),
      inactiveFlag: z.boolean().optional(),
      requestForChangeFlag: z.boolean().optional(),
      categoryId: z.number().optional(),
    },
    async (args) => {
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
    "Update a board type via JSON Patch.",
    {
      boardId: z.number(),
      typeId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ boardId, typeId, patch }) => {
      const result = await client.patch(`/service/boards/${boardId}/types/${typeId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_type",
    "Delete a board type.",
    {
      boardId: z.number(),
      typeId: z.number(),
    },
    async ({ boardId, typeId }) => {
      const result = await client.request("DELETE", `/service/boards/${boardId}/types/${typeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Board subtypes =====

  server.tool(
    "cw_list_board_subtypes",
    "List subtypes on a board.",
    {
      boardId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      boardId: z.number(),
      subTypeId: z.number(),
    },
    async ({ boardId, subTypeId }) => {
      const result = await client.get(`/service/boards/${boardId}/subtypes/${subTypeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_subtype",
    "Create a board subtype.",
    {
      boardId: z.number(),
      name: z.string(),
      inactiveFlag: z.boolean().optional(),
      addAllTypesFlag: z.boolean().optional(),
      removeAllTypesFlag: z.boolean().optional(),
    },
    async (args) => {
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
    "Update a board subtype via JSON Patch.",
    {
      boardId: z.number(),
      subTypeId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ boardId, subTypeId, patch }) => {
      const result = await client.patch(`/service/boards/${boardId}/subtypes/${subTypeId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_subtype",
    "Delete a board subtype.",
    {
      boardId: z.number(),
      subTypeId: z.number(),
    },
    async ({ boardId, subTypeId }) => {
      const result = await client.request("DELETE", `/service/boards/${boardId}/subtypes/${subTypeId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Board items =====

  server.tool(
    "cw_list_board_items",
    "List items on a board.",
    {
      boardId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      boardId: z.number(),
      itemId: z.number(),
    },
    async ({ boardId, itemId }) => {
      const result = await client.get(`/service/boards/${boardId}/items/${itemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_item",
    "Create a board item.",
    {
      boardId: z.number(),
      name: z.string(),
      inactiveFlag: z.boolean().optional(),
      categoryId: z.number().optional(),
      subCategoryId: z.number().optional(),
    },
    async (args) => {
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
    "Update a board item via JSON Patch.",
    {
      boardId: z.number(),
      itemId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ boardId, itemId, patch }) => {
      const result = await client.patch(`/service/boards/${boardId}/items/${itemId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_item",
    "Delete a board item.",
    {
      boardId: z.number(),
      itemId: z.number(),
    },
    async ({ boardId, itemId }) => {
      const result = await client.request("DELETE", `/service/boards/${boardId}/items/${itemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Board teams =====

  server.tool(
    "cw_list_board_teams",
    "List teams on a board.",
    {
      boardId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      boardId: z.number(),
      teamId: z.number(),
    },
    async ({ boardId, teamId }) => {
      const result = await client.get(`/service/boards/${boardId}/teams/${teamId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_board_team",
    "Create a board team.",
    {
      boardId: z.number(),
      name: z.string(),
      defaultFlag: z.boolean().optional(),
      notifyOnTicketDelete: z.boolean().optional(),
      teamLeaderId: z.number().optional(),
      businessUnitId: z.number().optional(),
      locationId: z.number().optional(),
    },
    async (args) => {
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
    "Update a board team via JSON Patch.",
    {
      boardId: z.number(),
      teamId: z.number(),
      patch: z.array(patchOp),
    },
    async ({ boardId, teamId, patch }) => {
      const result = await client.patch(`/service/boards/${boardId}/teams/${teamId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_board_team",
    "Delete a board team.",
    {
      boardId: z.number(),
      teamId: z.number(),
    },
    async ({ boardId, teamId }) => {
      const result = await client.request("DELETE", `/service/boards/${boardId}/teams/${teamId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Priorities =====

  server.tool(
    "cw_list_service_priorities",
    "List service priorities.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/service/priorities/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Sources =====

  server.tool(
    "cw_list_service_sources",
    "List ticket sources.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/service/sources/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== SLAs =====

  server.tool(
    "cw_list_slas",
    "List SLAs.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
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
      slaId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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

  // ===== Impacts & severities =====

  server.tool(
    "cw_list_impacts",
    "List impact values (Low / Medium / High).",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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

  // ===== Ticket templates =====

  server.tool(
    "cw_list_ticket_templates",
    "List ticket templates.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/service/ticketTemplates/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Surveys =====

  server.tool(
    "cw_list_surveys",
    "List service surveys.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
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
      surveyId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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

  // ===== Knowledgebase =====

  server.tool(
    "cw_list_kb_articles",
    "List knowledgebase articles.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/service/knowledgeBaseArticles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Code bases & categories =====

  server.tool(
    "cw_list_service_categories",
    "List service categories.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
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
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
