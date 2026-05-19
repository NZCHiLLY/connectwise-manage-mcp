import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";
import { patchOp, sentinelParams } from "./shared.js";

export function registerProjectTools(server: McpServer, client: CwManageClient) {
  // ── Projects ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_search_projects",
    "Search projects. Use 'conditions' for CW query syntax.",
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
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
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
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Child object conditions query string"),
      customFieldConditions: z.string().optional().describe("Custom field conditions query string"),
    },
    async (args) => {
      const result = await client.get("/project/projects/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_project",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a new project. name, companyId, and boardId are normally required.",
    {
      name: z.string().describe("Project name (required)"),
      companyId: z.number().describe("Customer company ID (required)"),
      boardId: z.number().describe("Service board ID (required)"),
      statusId: z.number().optional().describe("Project status ID"),
      typeId: z.number().optional().describe("Project type ID"),
      managerId: z.number().optional().describe("Project manager member ID"),
      contactId: z.number().optional().describe("Contact ID"),
      siteId: z.number().optional().describe("Site ID"),
      estimatedStart: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      estimatedEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      actualStart: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      actualEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      estimatedHours: z.number().optional().describe("Estimated hours for the project"),
      estimatedExpenseRevenue: z.number().optional().describe("Estimated expense revenue"),
      estimatedProductRevenue: z.number().optional().describe("Estimated product revenue"),
      estimatedTimeRevenue: z.number().optional().describe("Estimated time revenue"),
      billingMethod: z.string().optional().describe("ActualRates | FixedFee | NotToExceed | OverrideRate"),
      billingAmount: z.number().optional().describe("Billing amount"),
      downpayment: z.number().optional().describe("Downpayment amount"),
      billingAttention: z.string().optional().describe("Billing attention contact name"),
      restrictDownPaymentFlag: z.boolean().optional().describe("Restrict down payment"),
      restrictInvoiceFlag: z.boolean().optional().describe("Restrict invoice"),
      agreementId: z.number().optional().describe("Agreement ID"),
      opportunityId: z.number().optional().describe("Opportunity ID"),
      description: z.string().optional().describe("Project description"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional().describe("Custom field values"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_project", entityType: "project", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a project via JSON Patch.",
    {
      id: z.number().describe("Project ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ id, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_project", entityType: "project", entityId: id, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/project/projects/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_project",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Replace a project via PUT.",
    {
      id: z.number().describe("Project ID"),
      body: z.record(z.string(), z.unknown()).describe("Full replacement body for PUT"),
      ...sentinelParams,
    },
    async ({ id, body, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_replace_project", entityType: "project", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.put(`/project/projects/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a project. Destructive.",
    {
      id: z.number().describe("Project ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_project", entityType: "project", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/project/projects/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_project_to_template",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Save a project as a project template via /project/projects/{id}/copyToTemplate.",
    {
      id: z.number().describe("Source project ID"),
      name: z.string().describe("Template name"),
      copyNotesFlag: z.boolean().optional().describe("Copy notes to template"),
      copyTeamMembersFlag: z.boolean().optional().describe("Copy team members to template"),
      copyTimeEntriesFlag: z.boolean().optional().describe("Copy time entries to template"),
      copyDocumentsFlag: z.boolean().optional().describe("Copy documents to template"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_copy_project_to_template", entityType: "project", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.copyNotesFlag !== undefined) body.copyNotesFlag = args.copyNotesFlag;
      if (args.copyTeamMembersFlag !== undefined) body.copyTeamMembersFlag = args.copyTeamMembersFlag;
      if (args.copyTimeEntriesFlag !== undefined) body.copyTimeEntriesFlag = args.copyTimeEntriesFlag;
      if (args.copyDocumentsFlag !== undefined) body.copyDocumentsFlag = args.copyDocumentsFlag;
      const result = await client.post(`/project/projects/${args.id}/copyToTemplate`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project phases ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_project_phases",
    "List phases under a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a phase under a project. description is required.",
    {
      projectId: z.number().describe("Project ID"),
      description: z.string().describe("Phase description / name"),
      parentPhaseId: z.number().optional().describe("Parent phase ID for sub-phases"),
      wbsCode: z.string().optional().describe("WBS code for the phase"),
      billingMethod: z.string().optional().describe("ActualRates | FixedFee | NotToExceed | OverrideRate"),
      billPhaseSeparatelyFlag: z.boolean().optional().describe("Bill this phase separately"),
      billProjectAfterClosedFlag: z.boolean().optional().describe("Bill project after phase is closed"),
      billingAmount: z.number().optional().describe("Billing amount"),
      budgetHours: z.number().optional().describe("Budget hours for the phase"),
      scheduledStart: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      scheduledEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      scheduledHours: z.number().optional().describe("Scheduled hours for the phase"),
      actualStart: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      actualEnd: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      actualHours: z.number().optional().describe("Actual hours logged"),
      markAsMilestoneFlag: z.boolean().optional().describe("Mark this phase as a milestone"),
      notes: z.string().optional().describe("Phase notes"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_project_phase", entityType: "project_phase", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a project phase via JSON Patch.",
    {
      projectId: z.number().describe("Project ID"),
      phaseId: z.number().describe("Phase ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ projectId, phaseId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_project_phase", entityType: "project_phase", entityId: phaseId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/project/projects/${projectId}/phases/${phaseId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project_phase",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a project phase.",
    {
      projectId: z.number().describe("Project ID"),
      phaseId: z.number().describe("Phase ID"),
      ...sentinelParams,
    },
    async ({ projectId, phaseId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_project_phase", entityType: "project_phase", entityId: phaseId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/project/projects/${projectId}/phases/${phaseId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project team members ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_project_team_members",
    "List team members on a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a member to a project team.",
    {
      projectId: z.number().describe("Project ID"),
      memberId: z.number().describe("Member ID"),
      projectRoleId: z.number().describe("Project role ID"),
      hoursScheduled: z.number().optional().describe("Hours scheduled for this team member"),
      startDate: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      endDate: z.string().optional().describe("[YYYY-MM-DDTHH:MM:SSZ]"),
      workRoleId: z.number().optional().describe("Work role ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_project_team_member", entityType: "project_team_member", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a project team-member row via JSON Patch.",
    {
      projectId: z.number().describe("Project ID"),
      teamMemberId: z.number().describe("Team-member row ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ projectId, teamMemberId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_project_team_member", entityType: "project_team_member", entityId: teamMemberId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/project/projects/${projectId}/teamMembers/${teamMemberId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project_team_member",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a member from a project team.",
    {
      projectId: z.number().describe("Project ID"),
      teamMemberId: z.number().describe("Team-member row ID"),
      ...sentinelParams,
    },
    async ({ projectId, teamMemberId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_project_team_member", entityType: "project_team_member", entityId: teamMemberId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/project/projects/${projectId}/teamMembers/${teamMemberId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project notes ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_project_notes",
    "List notes on a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a note to a project.",
    {
      projectId: z.number().describe("Project ID"),
      text: z.string().describe("Note text"),
      typeId: z.number().optional().describe("Note type ID"),
      flagged: z.boolean().optional().describe("Flag this note"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_project_note", entityType: "project_note", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/project/projects/${args.projectId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_project_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a project note via JSON Patch.",
    {
      projectId: z.number().describe("Project ID"),
      noteId: z.number().describe("Note ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ projectId, noteId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_project_note", entityType: "project_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/project/projects/${projectId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_project_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a project note.",
    {
      projectId: z.number().describe("Project ID"),
      noteId: z.number().describe("Note ID"),
      ...sentinelParams,
    },
    async ({ projectId, noteId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_project_note", entityType: "project_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/project/projects/${projectId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project contacts ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_project_contacts",
    "List contacts on a project.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Attach a contact to a project.",
    {
      projectId: z.number().describe("Project ID"),
      contactId: z.number().describe("Contact ID"),
      ...sentinelParams,
    },
    async ({ projectId, contactId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_add_project_contact", entityType: "project_contact", entityId: contactId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/project/projects/${projectId}/contacts`, {
        id: contactId,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_remove_project_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a contact from a project.",
    {
      projectId: z.number().describe("Project ID"),
      contactId: z.number().describe("Contact ID"),
      ...sentinelParams,
    },
    async ({ projectId, contactId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_remove_project_contact", entityType: "project_contact", entityId: contactId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/project/projects/${projectId}/contacts/${contactId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project catalog: statuses, types, roles, security roles ─────────────────────────────────────────

  server.tool(
    "cw_list_project_statuses",
    "List project statuses.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Project status ID"),
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
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Project type ID"),
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
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Project role ID"),
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
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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

  // ── Project boards (subset of service boards used by projects) ─────────────────────────────────────────

  server.tool(
    "cw_list_project_boards",
    "List project boards.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Project board ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/project/boards/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Project ticket links (search tickets scoped to a project) ─────────────────────────────────────────

  server.tool(
    "cw_list_project_tickets",
    "List tickets attached to a project via /project/projects/{id}/tickets.",
    {
      projectId: z.number().describe("Project ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
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

  // ── Project templates ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_project_templates",
    "List project templates.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
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
      id: z.number().describe("Project template ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/project/projectTemplates/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
