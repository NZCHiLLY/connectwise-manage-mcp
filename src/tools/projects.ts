import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerProjectTools(server: McpServer, client: CwManageClient) {
  // ===== Projects =====

  server.tool(
    "cw_search_projects",
    "Search projects. Use 'conditions' for CW query syntax.",
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
      const result = await client.get("/project/projects", {
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
    "cw_get_project",
    "Get a single project by ID.",
    {
      id: z.number().describe("Project ID"),
      fields: z.string().optional(),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/project/projects/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_projects",
    "Count projects matching a conditions query.",
    {
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
    },
    async (args) => {
      const result = await client.get("/project/projects/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_project",
    "Create a new project. name, companyId, and boardId are normally required.",
    {
      name: z.string().describe("Project name (required)"),
      companyId: z.number().describe("Customer company ID (required)"),
      boardId: z.number().describe("Service board ID (required)"),
      statusId: z.number().optional(),
      typeId: z.number().optional(),
      managerId: z.number().optional().describe("Project manager (member) ID"),
      contactId: z.number().optional(),
      siteId: z.number().optional(),
      estimatedStart: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      estimatedEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      actualStart: z.string().optional(),
      actualEnd: z.string().optional(),
      estimatedHours: z.number().optional(),
      estimatedExpenseRevenue: z.number().optional(),
      estimatedProductRevenue: z.number().optional(),
      estimatedTimeRevenue: z.number().optional(),
      billingMethod: z.string().optional().describe("ActualRates | FixedFee | NotToExceed | OverrideRate"),
      billingAmount: z.number().optional(),
      downpayment: z.number().optional(),
      billingAttention: z.string().optional(),
      restrictDownPaymentFlag: z.boolean().optional(),
      restrictInvoiceFlag: z.boolean().optional(),
      agreementId: z.number().optional(),
      opportunityId: z.number().optional(),
      description: z.string().optional(),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        name: args.name,
        company: { id: args.companyId },
        board: { id: args.boardId },
      };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.managerId !== undefined) body.manager = { id: args.managerId };
      if (args.contactId !== undefined) body.contact = { id: args.contactId };
      if (args.siteId !== undefined) body.site = { id: args.siteId };
      if (args.estimatedStart) body.estimatedStart = args.estimatedStart;
      if (args.estimatedEnd) body.estimatedEnd = args.estimatedEnd;
      if (args.actualStart) body.actualStart = args.actualStart;
      if (args.actualEnd) body.actualEnd = args.actualEnd;
      if (args.estimatedHours !== undefined) body.estimatedHours = args.estimatedHours;
      if (args.estimatedExpenseRevenue !== undefined) body.estimatedExpenseRevenue = args.estimatedExpenseRevenue;
      if (args.estimatedProductRevenue !== undefined) body.estimatedProductRevenue = args.estimatedProductRevenue;
      if (args.estimatedTimeRevenue !== undefined) body.estimatedTimeRevenue = args.estimatedTimeRevenue;
      if (args.billingMethod) body.billingMethod = args.billingMethod;
      if (args.billingAmount !== undefined) body.billingAmount = args.billingAmount;
      if (args.downpayment !== undefined) body.downpayment = args.downpayment;
      if (args.billingAttention) body.billingAttention = args.billingAttention;
      if (args.restrictDownPaymentFlag !== undefined) body.restrictDownPaymentFlag = args.restrictDownPaymentFlag;
      if (args.restrictInvoiceFlag !== undefined) body.restrictInvoiceFlag = args.restrictInvoiceFlag;
      if (args.agreementId !== undefined) body.agreement = { id: args.agreementId };
      if (args.opportunityId !== undefined) body.opportunity = { id: args.opportunityId };
      if (args.description) body.description = args.description;
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/project/projects", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_project",
    "Update a project via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/project/projects/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_project",
    "Replace a project via PUT.",
    {
      id: z.number(),
      body: z.record(z.string(), z.unknown()),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/project/projects/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project",
    "Delete a project. Destructive.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/project/projects/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_project_to_template",
    "Save a project as a project template via /project/projects/{id}/copyToTemplate.",
    {
      id: z.number().describe("Source project ID"),
      name: z.string().describe("Template name"),
      copyNotesFlag: z.boolean().optional(),
      copyTeamMembersFlag: z.boolean().optional(),
      copyTimeEntriesFlag: z.boolean().optional(),
      copyDocumentsFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.copyNotesFlag !== undefined) body.copyNotesFlag = args.copyNotesFlag;
      if (args.copyTeamMembersFlag !== undefined) body.copyTeamMembersFlag = args.copyTeamMembersFlag;
      if (args.copyTimeEntriesFlag !== undefined) body.copyTimeEntriesFlag = args.copyTimeEntriesFlag;
      if (args.copyDocumentsFlag !== undefined) body.copyDocumentsFlag = args.copyDocumentsFlag;
      const result = await client.post(`/project/projects/${args.id}/copyToTemplate`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project phases =====

  server.tool(
    "cw_list_project_phases",
    "List phases under a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
    },
    async ({ projectId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/project/projects/${projectId}/phases`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_phase",
    "Get a single project phase.",
    {
      projectId: z.number().describe("Project ID"),
      phaseId: z.number().describe("Phase ID"),
    },
    async ({ projectId, phaseId }) => {
      const result = await client.get(`/project/projects/${projectId}/phases/${phaseId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_project_phase",
    "Create a phase under a project. description is required.",
    {
      projectId: z.number().describe("Project ID"),
      description: z.string().describe("Phase description / name"),
      parentPhaseId: z.number().optional().describe("Parent phase ID for sub-phases"),
      wbsCode: z.string().optional(),
      billingMethod: z.string().optional(),
      billPhaseSeparatelyFlag: z.boolean().optional(),
      billProjectAfterClosedFlag: z.boolean().optional(),
      billingAmount: z.number().optional(),
      budgetHours: z.number().optional(),
      scheduledStart: z.string().optional(),
      scheduledEnd: z.string().optional(),
      scheduledHours: z.number().optional(),
      actualStart: z.string().optional(),
      actualEnd: z.string().optional(),
      actualHours: z.number().optional(),
      markAsMilestoneFlag: z.boolean().optional(),
      notes: z.string().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { description: args.description };
      if (args.parentPhaseId !== undefined) body.parentPhase = { id: args.parentPhaseId };
      if (args.wbsCode) body.wbsCode = args.wbsCode;
      if (args.billingMethod) body.billingMethod = args.billingMethod;
      if (args.billPhaseSeparatelyFlag !== undefined) body.billPhaseSeparatelyFlag = args.billPhaseSeparatelyFlag;
      if (args.billProjectAfterClosedFlag !== undefined) body.billProjectAfterClosedFlag = args.billProjectAfterClosedFlag;
      if (args.billingAmount !== undefined) body.billingAmount = args.billingAmount;
      if (args.budgetHours !== undefined) body.budgetHours = args.budgetHours;
      if (args.scheduledStart) body.scheduledStart = args.scheduledStart;
      if (args.scheduledEnd) body.scheduledEnd = args.scheduledEnd;
      if (args.scheduledHours !== undefined) body.scheduledHours = args.scheduledHours;
      if (args.actualStart) body.actualStart = args.actualStart;
      if (args.actualEnd) body.actualEnd = args.actualEnd;
      if (args.actualHours !== undefined) body.actualHours = args.actualHours;
      if (args.markAsMilestoneFlag !== undefined) body.markAsMilestoneFlag = args.markAsMilestoneFlag;
      if (args.notes) body.notes = args.notes;
      const result = await client.post(`/project/projects/${args.projectId}/phases`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_project_phase",
    "Update a project phase via JSON Patch.",
    {
      projectId: z.number().describe("Project ID"),
      phaseId: z.number().describe("Phase ID"),
      patch: z.array(patchOp),
    },
    async ({ projectId, phaseId, patch }) => {
      const result = await client.patch(`/project/projects/${projectId}/phases/${phaseId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project_phase",
    "Delete a project phase.",
    {
      projectId: z.number().describe("Project ID"),
      phaseId: z.number().describe("Phase ID"),
    },
    async ({ projectId, phaseId }) => {
      const result = await client.request("DELETE", `/project/projects/${projectId}/phases/${phaseId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project team members =====

  server.tool(
    "cw_list_project_team_members",
    "List team members on a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ projectId, conditions, page, pageSize }) => {
      const result = await client.get(`/project/projects/${projectId}/teamMembers`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_team_member",
    "Get a single project team-member row.",
    {
      projectId: z.number().describe("Project ID"),
      teamMemberId: z.number().describe("Team-member row ID"),
    },
    async ({ projectId, teamMemberId }) => {
      const result = await client.get(`/project/projects/${projectId}/teamMembers/${teamMemberId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_project_team_member",
    "Add a member to a project team.",
    {
      projectId: z.number().describe("Project ID"),
      memberId: z.number().describe("Member ID"),
      projectRoleId: z.number().describe("Project role ID"),
      hoursScheduled: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      workRoleId: z.number().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        member: { id: args.memberId },
        projectRole: { id: args.projectRoleId },
      };
      if (args.hoursScheduled !== undefined) body.hoursScheduled = args.hoursScheduled;
      if (args.startDate) body.startDate = args.startDate;
      if (args.endDate) body.endDate = args.endDate;
      if (args.workRoleId !== undefined) body.workRole = { id: args.workRoleId };
      const result = await client.post(`/project/projects/${args.projectId}/teamMembers`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_project_team_member",
    "Update a project team-member row via JSON Patch.",
    {
      projectId: z.number().describe("Project ID"),
      teamMemberId: z.number().describe("Team-member row ID"),
      patch: z.array(patchOp),
    },
    async ({ projectId, teamMemberId, patch }) => {
      const result = await client.patch(`/project/projects/${projectId}/teamMembers/${teamMemberId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project_team_member",
    "Remove a member from a project team.",
    {
      projectId: z.number().describe("Project ID"),
      teamMemberId: z.number().describe("Team-member row ID"),
    },
    async ({ projectId, teamMemberId }) => {
      const result = await client.request("DELETE", `/project/projects/${projectId}/teamMembers/${teamMemberId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project notes =====

  server.tool(
    "cw_list_project_notes",
    "List notes on a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ projectId, conditions, page, pageSize }) => {
      const result = await client.get(`/project/projects/${projectId}/notes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_note",
    "Get a single project note.",
    {
      projectId: z.number().describe("Project ID"),
      noteId: z.number().describe("Note ID"),
    },
    async ({ projectId, noteId }) => {
      const result = await client.get(`/project/projects/${projectId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_project_note",
    "Add a note to a project.",
    {
      projectId: z.number().describe("Project ID"),
      text: z.string().describe("Note text"),
      typeId: z.number().optional().describe("Note type ID"),
      flagged: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/project/projects/${args.projectId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_project_note",
    "Update a project note via JSON Patch.",
    {
      projectId: z.number().describe("Project ID"),
      noteId: z.number().describe("Note ID"),
      patch: z.array(patchOp),
    },
    async ({ projectId, noteId, patch }) => {
      const result = await client.patch(`/project/projects/${projectId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project_note",
    "Delete a project note.",
    {
      projectId: z.number().describe("Project ID"),
      noteId: z.number().describe("Note ID"),
    },
    async ({ projectId, noteId }) => {
      const result = await client.request("DELETE", `/project/projects/${projectId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project contacts =====

  server.tool(
    "cw_list_project_contacts",
    "List contacts on a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ projectId, conditions, page, pageSize }) => {
      const result = await client.get(`/project/projects/${projectId}/contacts`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_project_contact",
    "Attach a contact to a project.",
    {
      projectId: z.number().describe("Project ID"),
      contactId: z.number().describe("Contact ID"),
    },
    async ({ projectId, contactId }) => {
      const result = await client.post(`/project/projects/${projectId}/contacts`, {
        id: contactId,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_remove_project_contact",
    "Remove a contact from a project.",
    {
      projectId: z.number().describe("Project ID"),
      contactId: z.number().describe("Contact ID"),
    },
    async ({ projectId, contactId }) => {
      const result = await client.request("DELETE", `/project/projects/${projectId}/contacts/${contactId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project catalog: statuses, types, roles, security roles =====

  server.tool(
    "cw_list_project_statuses",
    "List project statuses.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/project/statuses", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_status",
    "Get a single project status.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/project/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_project_types",
    "List project types.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/project/projectTypes", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_type",
    "Get a single project type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/project/projectTypes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_project_roles",
    "List project roles (used on team-member rows).",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/project/projectRoles", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_role",
    "Get a project role.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/project/projectRoles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_project_security_roles",
    "List project security roles.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/project/securityRoles", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project boards (subset of service boards used by projects) =====

  server.tool(
    "cw_list_project_boards",
    "List project boards.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/project/boards", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_board",
    "Get a project board.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/project/boards/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project ticket links (search tickets scoped to a project) =====

  server.tool(
    "cw_list_project_tickets",
    "List tickets attached to a project via /project/projects/{id}/tickets.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
    },
    async ({ projectId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/project/projects/${projectId}/tickets`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Project templates =====

  server.tool(
    "cw_list_project_templates",
    "List project templates.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/project/projectTemplates", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_project_template",
    "Get a project template.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/project/projectTemplates/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
