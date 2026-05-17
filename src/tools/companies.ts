import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerCompanyTools(server: McpServer, client: CwManageClient) {
  // ===== Companies =====

  server.tool(
    "cw_search_companies",
    "Search companies. Use 'conditions' for CW query syntax (e.g. \"name like 'Acme%'\").",
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
      const result = await client.get("/company/companies", {
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
    "cw_get_company",
    "Get a single company by ID.",
    {
      id: z.number().describe("Company ID"),
      fields: z.string().optional(),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/company/companies/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_companies",
    "Count companies matching a conditions query.",
    {
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
    },
    async (args) => {
      const result = await client.get("/company/companies/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_company",
    "Create a new company. identifier (account code) and name are required.",
    {
      identifier: z.string().describe("Company account code / identifier"),
      name: z.string().describe("Company display name"),
      typeId: z.number().optional().describe("Company type ID"),
      statusId: z.number().optional().describe("Company status ID"),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      countryId: z.number().optional(),
      phoneNumber: z.string().optional(),
      faxNumber: z.string().optional(),
      website: z.string().optional(),
      marketId: z.number().optional(),
      territoryId: z.number().optional(),
      accountNumber: z.string().optional(),
      defaultContactId: z.number().optional(),
      annualRevenue: z.number().optional(),
      numberOfEmployees: z.number().optional(),
      yearEstablished: z.number().optional(),
      leadFlag: z.boolean().optional(),
      vendorIdentifier: z.string().optional(),
      taxIdentifier: z.string().optional(),
      taxCodeId: z.number().optional(),
      billToCompanyId: z.number().optional(),
      parentCompanyId: z.number().optional(),
      defaultDepartmentId: z.number().optional(),
      defaultLocationId: z.number().optional(),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        identifier: args.identifier,
        name: args.name,
      };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.statusId !== undefined) body.status = { id: args.statusId };
      if (args.addressLine1) body.addressLine1 = args.addressLine1;
      if (args.addressLine2) body.addressLine2 = args.addressLine2;
      if (args.city) body.city = args.city;
      if (args.state) body.state = args.state;
      if (args.zip) body.zip = args.zip;
      if (args.countryId !== undefined) body.country = { id: args.countryId };
      if (args.phoneNumber) body.phoneNumber = args.phoneNumber;
      if (args.faxNumber) body.faxNumber = args.faxNumber;
      if (args.website) body.website = args.website;
      if (args.marketId !== undefined) body.market = { id: args.marketId };
      if (args.territoryId !== undefined) body.territory = { id: args.territoryId };
      if (args.accountNumber) body.accountNumber = args.accountNumber;
      if (args.defaultContactId !== undefined) body.defaultContact = { id: args.defaultContactId };
      if (args.annualRevenue !== undefined) body.annualRevenue = args.annualRevenue;
      if (args.numberOfEmployees !== undefined) body.numberOfEmployees = args.numberOfEmployees;
      if (args.yearEstablished !== undefined) body.yearEstablished = args.yearEstablished;
      if (args.leadFlag !== undefined) body.leadFlag = args.leadFlag;
      if (args.vendorIdentifier) body.vendorIdentifier = args.vendorIdentifier;
      if (args.taxIdentifier) body.taxIdentifier = args.taxIdentifier;
      if (args.taxCodeId !== undefined) body.taxCode = { id: args.taxCodeId };
      if (args.billToCompanyId !== undefined) body.billToCompany = { id: args.billToCompanyId };
      if (args.parentCompanyId !== undefined) body.parentCompany = { id: args.parentCompanyId };
      if (args.defaultDepartmentId !== undefined) body.defaultDepartment = { id: args.defaultDepartmentId };
      if (args.defaultLocationId !== undefined) body.defaultLocation = { id: args.defaultLocationId };
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/company/companies", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_company",
    "Update an existing company using JSON Patch operations. " +
      "REQUIRED: you must include 'user_intent' (plain-English description of what " +
      "the user asked for) and 'user_quote' (verbatim text from the user that " +
      "motivated this change). These are logged for audit. If you cannot quote " +
      "the user or articulate their intent, do not call this tool — ask the user first.",
    {
      id: z.number().describe("Company ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to update the phone number for Acme Corp.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this update. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]).describe("Patch operation"),
        path: z.string().describe("JSON path (e.g. 'name', 'phoneNumber')"),
        value: z.unknown().optional().describe("New value"),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, user_intent, user_quote, operations }) => {
      await auditLog({ tool: "cw_update_company", entityType: "company", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/companies/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_company",
    "Replace a company via PUT.",
    {
      id: z.number().describe("Company ID"),
      body: z.record(z.string(), z.unknown()).describe("Full company body"),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/company/companies/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_company",
    "Delete a company. Destructive — typically blocked if there are dependent records.",
    {
      id: z.number().describe("Company ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/company/companies/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_merge_companies",
    "Merge a source company into a target company via /company/companies/{targetId}/merge.",
    {
      targetCompanyId: z.number().describe("Surviving company ID"),
      sourceCompanyId: z.number().describe("Company to merge in (will be deactivated)"),
    },
    async ({ targetCompanyId, sourceCompanyId }) => {
      const result = await client.post(`/company/companies/${targetCompanyId}/merge`, {
        sourceCompany: { id: sourceCompanyId },
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Company sites =====

  server.tool(
    "cw_list_company_sites",
    "List sites for a company.",
    {
      companyId: z.number().describe("Company ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
    },
    async ({ companyId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/company/companies/${companyId}/sites`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_company_site",
    "Get a single company site.",
    {
      companyId: z.number().describe("Company ID"),
      siteId: z.number().describe("Site ID"),
    },
    async ({ companyId, siteId }) => {
      const result = await client.get(`/company/companies/${companyId}/sites/${siteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_company_site",
    "Create a new site on a company.",
    {
      companyId: z.number().describe("Company ID"),
      name: z.string().describe("Site name"),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      countryId: z.number().optional(),
      phoneNumber: z.string().optional(),
      faxNumber: z.string().optional(),
      timeZoneId: z.number().optional(),
      taxCodeId: z.number().optional(),
      primaryAddressFlag: z.boolean().optional(),
      defaultMailingFlag: z.boolean().optional(),
      defaultShippingFlag: z.boolean().optional(),
      defaultBillingFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.addressLine1) body.addressLine1 = args.addressLine1;
      if (args.addressLine2) body.addressLine2 = args.addressLine2;
      if (args.city) body.city = args.city;
      if (args.state) body.state = args.state;
      if (args.zip) body.zip = args.zip;
      if (args.countryId !== undefined) body.country = { id: args.countryId };
      if (args.phoneNumber) body.phoneNumber = args.phoneNumber;
      if (args.faxNumber) body.faxNumber = args.faxNumber;
      if (args.timeZoneId !== undefined) body.timeZone = { id: args.timeZoneId };
      if (args.taxCodeId !== undefined) body.taxCode = { id: args.taxCodeId };
      if (args.primaryAddressFlag !== undefined) body.primaryAddressFlag = args.primaryAddressFlag;
      if (args.defaultMailingFlag !== undefined) body.defaultMailingFlag = args.defaultMailingFlag;
      if (args.defaultShippingFlag !== undefined) body.defaultShippingFlag = args.defaultShippingFlag;
      if (args.defaultBillingFlag !== undefined) body.defaultBillingFlag = args.defaultBillingFlag;
      const result = await client.post(`/company/companies/${args.companyId}/sites`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_company_site",
    "Update a company site via JSON Patch.",
    {
      companyId: z.number().describe("Company ID"),
      siteId: z.number().describe("Site ID"),
      patch: z.array(patchOp),
    },
    async ({ companyId, siteId, patch }) => {
      const result = await client.patch(`/company/companies/${companyId}/sites/${siteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_company_site",
    "Delete a company site.",
    {
      companyId: z.number().describe("Company ID"),
      siteId: z.number().describe("Site ID"),
    },
    async ({ companyId, siteId }) => {
      const result = await client.request("DELETE", `/company/companies/${companyId}/sites/${siteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Company notes =====

  server.tool(
    "cw_list_company_notes",
    "List notes on a company.",
    {
      companyId: z.number().describe("Company ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ companyId, conditions, page, pageSize }) => {
      const result = await client.get(`/company/companies/${companyId}/notes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_company_note",
    "Get a single company note.",
    {
      companyId: z.number().describe("Company ID"),
      noteId: z.number().describe("Note ID"),
    },
    async ({ companyId, noteId }) => {
      const result = await client.get(`/company/companies/${companyId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_company_note",
    "Add a note to a company.",
    {
      companyId: z.number().describe("Company ID"),
      text: z.string().describe("Note text"),
      typeId: z.number().optional().describe("Note type ID"),
      enteredBy: z.string().optional().describe("Member identifier of author"),
      flagged: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.enteredBy) body.enteredBy = args.enteredBy;
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/company/companies/${args.companyId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_company_note",
    "Update a company note via JSON Patch.",
    {
      companyId: z.number().describe("Company ID"),
      noteId: z.number().describe("Note ID"),
      patch: z.array(patchOp),
    },
    async ({ companyId, noteId, patch }) => {
      const result = await client.patch(`/company/companies/${companyId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_company_note",
    "Delete a company note.",
    {
      companyId: z.number().describe("Company ID"),
      noteId: z.number().describe("Note ID"),
    },
    async ({ companyId, noteId }) => {
      const result = await client.request("DELETE", `/company/companies/${companyId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Company teams =====

  server.tool(
    "cw_list_company_teams",
    "List account-team rows on a company (who internally owns / supports this account).",
    {
      companyId: z.number().describe("Company ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ companyId, conditions, page, pageSize }) => {
      const result = await client.get(`/company/companies/${companyId}/teams`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_company_team",
    "Get a single team assignment on a company.",
    {
      companyId: z.number().describe("Company ID"),
      teamId: z.number().describe("Team-row ID"),
    },
    async ({ companyId, teamId }) => {
      const result = await client.get(`/company/companies/${companyId}/teams/${teamId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_company_team",
    "Add an internal team member to a company's account team.",
    {
      companyId: z.number().describe("Company ID"),
      teamRoleId: z.number().describe("Team role ID"),
      memberId: z.number().optional().describe("Internal member ID"),
      contactId: z.number().optional().describe("Contact ID (for client-side team members)"),
      locationId: z.number().optional(),
      businessUnitId: z.number().optional(),
      accountManagerFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { teamRole: { id: args.teamRoleId } };
      if (args.memberId !== undefined) body.member = { id: args.memberId };
      if (args.contactId !== undefined) body.contact = { id: args.contactId };
      if (args.locationId !== undefined) body.location = { id: args.locationId };
      if (args.businessUnitId !== undefined) body.businessUnit = { id: args.businessUnitId };
      if (args.accountManagerFlag !== undefined) body.accountManagerFlag = args.accountManagerFlag;
      const result = await client.post(`/company/companies/${args.companyId}/teams`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_company_team",
    "Update a company team row via JSON Patch.",
    {
      companyId: z.number().describe("Company ID"),
      teamId: z.number().describe("Team-row ID"),
      patch: z.array(patchOp),
    },
    async ({ companyId, teamId, patch }) => {
      const result = await client.patch(`/company/companies/${companyId}/teams/${teamId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_company_team",
    "Remove a member from a company's account team.",
    {
      companyId: z.number().describe("Company ID"),
      teamId: z.number().describe("Team-row ID"),
    },
    async ({ companyId, teamId }) => {
      const result = await client.request("DELETE", `/company/companies/${companyId}/teams/${teamId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Company custom fields =====

  server.tool(
    "cw_list_company_custom_fields",
    "List custom-field definitions visible to companies via /company/companies/customFields.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async (args) => {
      const result = await client.get("/company/companies/customFields", {
        conditions: args.conditions,
        page: args.page ?? 1,
        pageSize: args.pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Related listings on a company =====

  server.tool(
    "cw_list_company_management_summary",
    "List management-summary-report rows for a company via /company/companies/{id}/managementSummaryReports.",
    {
      companyId: z.number().describe("Company ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ companyId, conditions, page, pageSize }) => {
      const result = await client.get(`/company/companies/${companyId}/managementSummaryReports`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Company statuses =====

  server.tool(
    "cw_list_company_statuses",
    "List company statuses.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/companies/statuses", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_company_status",
    "Get a single company status.",
    {
      id: z.number().describe("Status ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/companies/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_company_status",
    "Create a company status.",
    {
      name: z.string().describe("Status name"),
      defaultFlag: z.boolean().optional(),
      inactiveFlag: z.boolean().optional(),
      noticeFlag: z.boolean().optional(),
      notifyFlag: z.boolean().optional(),
      notificationMessage: z.string().optional(),
      cancelOpenTracksFlag: z.boolean().optional(),
      trackId: z.number().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.noticeFlag !== undefined) body.noticeFlag = args.noticeFlag;
      if (args.notifyFlag !== undefined) body.notifyFlag = args.notifyFlag;
      if (args.notificationMessage) body.notificationMessage = args.notificationMessage;
      if (args.cancelOpenTracksFlag !== undefined) body.cancelOpenTracksFlag = args.cancelOpenTracksFlag;
      if (args.trackId !== undefined) body.track = { id: args.trackId };
      const result = await client.post("/company/companies/statuses", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_company_status",
    "Update a company status via JSON Patch.",
    {
      id: z.number().describe("Status ID"),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/company/companies/statuses/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_company_status",
    "Delete a company status.",
    {
      id: z.number().describe("Status ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/company/companies/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Company types =====

  server.tool(
    "cw_list_company_types",
    "List company types.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/companies/types", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_company_type",
    "Get a single company type.",
    {
      id: z.number().describe("Type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/companies/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_company_type",
    "Create a company type.",
    {
      name: z.string(),
      defaultFlag: z.boolean().optional(),
      vendorFlag: z.boolean().optional(),
      serviceAlertFlag: z.boolean().optional(),
      serviceAlertMessage: z.string().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { name: args.name };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.vendorFlag !== undefined) body.vendorFlag = args.vendorFlag;
      if (args.serviceAlertFlag !== undefined) body.serviceAlertFlag = args.serviceAlertFlag;
      if (args.serviceAlertMessage) body.serviceAlertMessage = args.serviceAlertMessage;
      const result = await client.post("/company/companies/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_company_type",
    "Update a company type via JSON Patch.",
    {
      id: z.number().describe("Type ID"),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/company/companies/types/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_company_type",
    "Delete a company type.",
    {
      id: z.number().describe("Type ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/company/companies/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Team roles =====

  server.tool(
    "cw_list_team_roles",
    "List company team-role definitions.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/teamRoles", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_team_role",
    "Get a single team role.",
    {
      id: z.number().describe("Team role ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/teamRoles/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Markets / territories =====

  server.tool(
    "cw_list_company_markets",
    "List market descriptions.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/marketDescriptions", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_company_ownership_types",
    "List ownership types.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/ownershipTypes", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
