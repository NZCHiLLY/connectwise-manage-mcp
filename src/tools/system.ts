import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

/**
 * System tools — covers /system subtree.
 * Notable: members have no DELETE (use inactiveFlag PATCH) — CW returns 400.
 */
export function registerSystemTools(server: McpServer, client: CwManageClient) {
  // ── /system/members ──────────────────────────────────────────────────────

  server.tool(
    "cw_search_members",
    "Search members (users / techs) in ConnectWise Manage. Use 'conditions' for CW query syntax (e.g. \"inactiveFlag = false and licenseClass = 'F'\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/members", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_member",
    "Get a single member by ID.",
    {
      id: z.number().describe("Member ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/members/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_member",
    "Create a member. Required: identifier (≤15 chars), firstName, lastName, licenseClass ('F'=Full, 'A'=API, 'S'=StreamlineIT, 'C'=Subcontractor), title, defaultEmail, primaryEmail.",
    {
      identifier: z.string().describe("Login identifier — max 15 chars"),
      firstName: z.string().describe("First name"),
      lastName: z.string().describe("Last name"),
      licenseClass: z.string().describe("'F' (Full), 'A' (API), 'S' (StreamlineIT), 'C' (Subcontractor)"),
      title: z.string().describe("Job title"),
      defaultEmail: z.string().describe("Default email type ('Office', 'Home', 'Other')"),
      primaryEmail: z.string().describe("Primary email address"),
      reportsToId: z.number().optional().describe("Manager / reports-to member ID"),
      officeEmail: z.string().optional().describe("Office email address"),
      officePhone: z.string().optional().describe("Office phone number"),
      mobilePhone: z.string().optional().describe("Mobile phone number"),
      homePhone: z.string().optional().describe("Home phone number"),
      vendorNumber: z.string().optional().describe("Vendor number for subcontractors"),
      notes: z.string().optional().describe("Free-text notes"),
      timeZoneId: z.number().optional().describe("Time zone ID"),
      countryId: z.number().optional().describe("Country ID"),
      timeApprover: z.object({ id: z.number() }).optional().describe("Time approver member reference"),
      expenseApprover: z.object({ id: z.number() }).optional().describe("Expense approver member reference"),
      billableForecast: z.number().optional().describe("Forecast billable hours"),
      dailyCapacity: z.number().optional().describe("Daily working hours capacity"),
      departmentId: z.number().optional().describe("Department ID"),
      locationId: z.number().optional().describe("Location/territory ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      defaultDepartmentId: z.number().optional().describe("Default service department ID"),
      defaultLocationId: z.number().optional().describe("Default service location ID"),
      workRoleId: z.number().optional().describe("Default work role ID"),
      workTypeId: z.number().optional().describe("Default work type ID"),
      securityRoleId: z.number().optional().describe("Security role ID"),
      adminFlag: z.boolean().optional().describe("Admin flag"),
      enableMobileFlag: z.boolean().optional().describe("Mobile access enabled"),
      hireDate: z.string().optional().describe("Hire date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        identifier: args.identifier,
        firstName: args.firstName,
        lastName: args.lastName,
        licenseClass: args.licenseClass,
        title: args.title,
        defaultEmail: args.defaultEmail,
        primaryEmail: args.primaryEmail,
      };
      if (args.reportsToId) body.reportsTo = { id: args.reportsToId };
      if (args.officeEmail) body.officeEmail = args.officeEmail;
      if (args.officePhone) body.officePhone = args.officePhone;
      if (args.mobilePhone) body.mobilePhone = args.mobilePhone;
      if (args.homePhone) body.homePhone = args.homePhone;
      if (args.vendorNumber) body.vendorNumber = args.vendorNumber;
      if (args.notes) body.notes = args.notes;
      if (args.timeZoneId) body.timeZone = { id: args.timeZoneId };
      if (args.countryId) body.country = { id: args.countryId };
      if (args.timeApprover) body.timeApprover = args.timeApprover;
      if (args.expenseApprover) body.expenseApprover = args.expenseApprover;
      if (args.billableForecast !== undefined) body.billableForecast = args.billableForecast;
      if (args.dailyCapacity !== undefined) body.dailyCapacity = args.dailyCapacity;
      if (args.departmentId) body.department = { id: args.departmentId };
      if (args.locationId) body.location = { id: args.locationId };
      if (args.businessUnitId) body.businessUnit = { id: args.businessUnitId };
      if (args.defaultDepartmentId) body.defaultDepartment = { id: args.defaultDepartmentId };
      if (args.defaultLocationId) body.defaultLocation = { id: args.defaultLocationId };
      if (args.workRoleId) body.workRole = { id: args.workRoleId };
      if (args.workTypeId) body.workType = { id: args.workTypeId };
      if (args.securityRoleId) body.securityRole = { id: args.securityRoleId };
      if (args.adminFlag !== undefined) body.adminFlag = args.adminFlag;
      if (args.enableMobileFlag !== undefined) body.enableMobileFlag = args.enableMobileFlag;
      if (args.hireDate) body.hireDate = args.hireDate;

      const result = await client.post("/system/members", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_member",
    "Update a member via JSON Patch. To deactivate, replace inactiveFlag=true (DO NOT call DELETE — CW returns 400).",
    {
      id: z.number().describe("Member ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/system/members/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_deactivate_member",
    "Deactivate a member by PATCHing inactiveFlag=true. Use INSTEAD OF delete — CW does not support DELETE on members.",
    {
      id: z.number().describe("Member ID"),
    },
    async ({ id }) => {
      const result = await client.patch(`/system/members/${id}`, [
        { op: "replace", path: "inactiveFlag", value: true },
      ]);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_member_image",
    "Get a member's profile image. Returns binary image data.",
    {
      id: z.number().describe("Member ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/members/${id}/image`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_member_skills",
    "List a member's skills.",
    {
      memberId: z.number().describe("Parent member ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ memberId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/members/${memberId}/skills`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_member_skill",
    "Add a skill to a member's profile.",
    {
      memberId: z.number().describe("Parent member ID"),
      skillId: z.number().describe("Skill ID from /system/skills"),
      level: z.string().optional().describe("Skill level"),
      certifiedFlag: z.boolean().optional().describe("Certified in this skill"),
      yearsOfExperience: z.number().optional().describe("Years of experience"),
    },
    async ({ memberId, skillId, level, certifiedFlag, yearsOfExperience }) => {
      const body: Record<string, unknown> = { skill: { id: skillId } };
      if (level) body.level = level;
      if (certifiedFlag !== undefined) body.certifiedFlag = certifiedFlag;
      if (yearsOfExperience !== undefined) body.yearsOfExperience = yearsOfExperience;
      const result = await client.post(`/system/members/${memberId}/skills`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_member_skill",
    "Remove a skill from a member's profile.",
    {
      memberId: z.number().describe("Parent member ID"),
      skillEntryId: z.number().describe("Member-skill entry ID"),
    },
    async ({ memberId, skillEntryId }) => {
      const result = await client.request("DELETE", `/system/members/${memberId}/skills/${skillEntryId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_member_notifications",
    "List a member's notification settings.",
    {
      memberId: z.number().describe("Parent member ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ memberId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/members/${memberId}/notificationSettings`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/apiMembers ───────────────────────────────────────────────────

  server.tool(
    "cw_search_api_members",
    "Search API members (the integration-only user accounts used for API access).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/apiMembers", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_api_member",
    "Get a single API member by ID.",
    {
      id: z.number().describe("API member ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/apiMembers/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_api_member_keys",
    "List the API keys (publicKey / privateKey pairs) belonging to an API member.",
    {
      apiMemberId: z.number().describe("Parent API member ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ apiMemberId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/apiMembers/${apiMemberId}/apiKeys`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_api_member_key",
    "Create a new API key for an API member. Response includes the privateKey ONCE — never returned again. Store it immediately.",
    {
      apiMemberId: z.number().describe("Parent API member ID"),
      description: z.string().describe("Description for the key (purpose / which integration)"),
    },
    async ({ apiMemberId, description }) => {
      const result = await client.post(`/system/apiMembers/${apiMemberId}/apiKeys`, { description });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_api_member_key",
    "Revoke / delete an API key from an API member.",
    {
      apiMemberId: z.number().describe("Parent API member ID"),
      apiKeyId: z.number().describe("API key ID"),
    },
    async ({ apiMemberId, apiKeyId }) => {
      const result = await client.request("DELETE", `/system/apiMembers/${apiMemberId}/apiKeys/${apiKeyId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/securityRoles ────────────────────────────────────────────────

  server.tool(
    "cw_list_security_roles",
    "List security roles (Admin, Tech, Manager, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/securityRoles", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_security_role",
    "Get a single security role by ID.",
    {
      id: z.number().describe("Security role ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/securityRoles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_security_role_permissions",
    "List permissions assigned to a security role.",
    {
      securityRoleId: z.number().describe("Parent security role ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ securityRoleId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/securityRoles/${securityRoleId}/permissions`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_security_role_settings",
    "List system-setting overrides assigned to a security role.",
    {
      securityRoleId: z.number().describe("Parent security role ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ securityRoleId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/securityRoles/${securityRoleId}/settings`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/departments ──────────────────────────────────────────────────

  server.tool(
    "cw_list_departments",
    "List departments (organisational units — e.g. Sales, Service Desk, Projects).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/departments", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_department",
    "Get a single department by ID.",
    {
      id: z.number().describe("Department ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/departments/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/locations ────────────────────────────────────────────────────

  server.tool(
    "cw_list_locations",
    "List locations (territories — e.g. North Island, South Island, US-East).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/locations", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_location",
    "Get a single location by ID.",
    {
      id: z.number().describe("Location ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/locations/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/myCompany ────────────────────────────────────────────────────

  server.tool(
    "cw_get_my_company",
    "Get 'My Company' record — the CW Manage tenant's own organisation info.",
    {},
    async () => {
      const result = await client.get("/system/myCompany");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_my_account",
    "Get the currently-authenticated member's account record.",
    {},
    async () => {
      const result = await client.get("/system/myAccount");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/audittrail ───────────────────────────────────────────────────

  server.tool(
    "cw_list_audit_trail",
    "List system audit trail entries.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/audittrail", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/callbacks ────────────────────────────────────────────────────

  server.tool(
    "cw_list_callbacks",
    "List callback / webhook registrations.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/callbacks", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_callback",
    "Get a single callback registration by ID.",
    {
      id: z.number().describe("Callback ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/callbacks/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_callback",
    "Register a callback / webhook for a given event type. CW POSTs the event payload to your URL when the event fires.",
    {
      url: z.string().describe("Target URL CW POSTs to"),
      objectId: z.number().describe("Object ID the callback subscribes to (use 1 to subscribe to all)"),
      type: z.string().describe("Event type ('ticket', 'company', 'agreement', 'project', etc.)"),
      level: z.string().describe("Subscription level ('status' or 'owner')"),
      description: z.string().optional().describe("Description"),
      memberId: z.number().optional().describe("Owner member ID"),
      payloadVersion: z.string().optional().describe("Payload version ('1.0', '2.0')"),
    },
    async ({ url, objectId, type, level, description, memberId, payloadVersion }) => {
      const body: Record<string, unknown> = { url, objectId, type, level };
      if (description) body.description = description;
      if (memberId) body.memberId = memberId;
      if (payloadVersion) body.payloadVersion = payloadVersion;
      const result = await client.post("/system/callbacks", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_callback",
    "Update a callback registration via JSON Patch.",
    {
      id: z.number().describe("Callback ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, operations }) => {
      const result = await client.patch(`/system/callbacks/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_callback",
    "Delete a callback / webhook registration.",
    {
      id: z.number().describe("Callback ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/system/callbacks/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/userDefinedFields ────────────────────────────────────────────

  server.tool(
    "cw_list_user_defined_fields",
    "List user-defined fields (UDFs / custom fields) defined across CW.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/userDefinedFields", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_user_defined_field",
    "Get a single user-defined field by ID.",
    {
      id: z.number().describe("UDF ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/userDefinedFields/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/reports ──────────────────────────────────────────────────────

  server.tool(
    "cw_list_reports",
    "List reports defined in CW.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/reports", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_report",
    "Get a single report definition by name.",
    {
      name: z.string().describe("Report name"),
    },
    async ({ name }) => {
      const result = await client.get(`/system/reports/${name}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_run_report",
    "Run a report by name and return the rows. Use 'conditions' to filter, 'orderBy' to sort.",
    {
      name: z.string().describe("Report name"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ name, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/reports/${name}/count`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/integratorLogins ─────────────────────────────────────────────

  server.tool(
    "cw_list_integrator_logins",
    "List integrator-login records (legacy integration accounts).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/integratorLogins", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_integrator_login",
    "Get a single integrator-login record by ID.",
    {
      id: z.number().describe("Integrator login ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/integratorLogins/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/menuEntries ──────────────────────────────────────────────────

  server.tool(
    "cw_list_menu_entries",
    "List custom menu-entry definitions (the user-defined menu items embedded in CW screens).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/menuEntries", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/workflows ────────────────────────────────────────────────────

  server.tool(
    "cw_list_workflows",
    "List workflows configured in CW.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/workflows", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_workflow",
    "Get a single workflow by ID.",
    {
      id: z.number().describe("Workflow ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/workflows/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/surveys ──────────────────────────────────────────────────────

  server.tool(
    "cw_list_surveys",
    "List survey templates.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/surveys", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_survey",
    "Get a single survey template by ID.",
    {
      id: z.number().describe("Survey ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/surveys/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_survey_results",
    "List the responses returned for a given survey.",
    {
      surveyId: z.number().describe("Parent survey ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ surveyId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/system/surveys/${surveyId}/results`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/documents ────────────────────────────────────────────────────

  server.tool(
    "cw_list_documents",
    "List system-attached documents.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/documents", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_document",
    "Get a single document by ID.",
    {
      id: z.number().describe("Document ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/documents/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_document",
    "Delete a document by ID.",
    {
      id: z.number().describe("Document ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/system/documents/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/in_outBoard ──────────────────────────────────────────────────

  server.tool(
    "cw_list_in_out_board",
    "List in/out-board entries (who is in office, out, on leave, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/in_outBoard", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_in_out_types",
    "List in/out-board type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/in_outTypes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/kpis ─────────────────────────────────────────────────────────

  server.tool(
    "cw_list_kpis",
    "List KPI definitions configured in CW.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/kpis", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_kpi",
    "Get a single KPI by ID.",
    {
      id: z.number().describe("KPI ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/kpis/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/sla ──────────────────────────────────────────────────────────

  server.tool(
    "cw_list_slas",
    "List SLA (service-level agreement) definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/sla", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_sla",
    "Get a single SLA definition by ID.",
    {
      id: z.number().describe("SLA ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/sla/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/notificationRecipients ───────────────────────────────────────

  server.tool(
    "cw_list_notification_recipients",
    "List notification-recipient definitions (groups / roles that receive system notifications).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/notificationRecipients", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/links ────────────────────────────────────────────────────────

  server.tool(
    "cw_list_links",
    "List configured external-system links.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/system/links", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_link",
    "Get a single link by ID.",
    {
      id: z.number().describe("Link ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/system/links/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /system/info ─────────────────────────────────────────────────────────

  server.tool(
    "cw_get_system_info",
    "Get CW Manage version / build / tenant info.",
    {},
    async () => {
      const result = await client.get("/system/info");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
