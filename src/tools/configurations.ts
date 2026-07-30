import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";
import { sentinelParams } from "./shared.js";

/**
 * Configurations tools — full coverage of /company/configurations subtree.
 * The asset register surface: instances, their type templates (with the
 * dynamic question framework), and lifecycle statuses.
 *
 * Distinct from /procurement/products — products are catalog instances
 * billed onto tickets/agreements, configurations are deployed assets.
 *
 * Register this file's `registerConfigurationTools` INSTEAD OF any prior
 * configurations registration in index.ts.
 */

export function registerConfigurationTools(server: McpServer, client: CwManageClient) {
  // ── /company/configurations (instances) ──────────────────────────────────

  server.tool(
    "cw_search_configurations",
    "Search company configurations (deployed assets). Use 'conditions' for CW query syntax (e.g. \"company/id = 17 and status/name = 'Active'\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/company/configurations", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_configuration",
    "Get a single configuration (asset) by ID.",
    {
      id: z.number().describe("Configuration ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/configurations/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_configuration",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a configuration (deployed asset). Required: name, typeId, companyId, statusId.",
    {
      name: z.string().describe("Configuration name / asset label"),
      typeId: z.number().describe("Configuration type ID"),
      companyId: z.number().describe("Owning company ID"),
      statusId: z.number().describe("Configuration status ID"),
      contactId: z.number().optional().describe("Primary contact ID"),
      siteId: z.number().optional().describe("Site ID"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      deviceIdentifier: z.string().optional().describe("Device identifier"),
      serialNumber: z.string().optional().describe("Serial number"),
      modelNumber: z.string().optional().describe("Model number"),
      tagNumber: z.string().optional().describe("Asset tag number"),
      purchaseDate: z.string().optional().describe("Purchase date in CW format: YYYY-MM-DDTHH:MM:SSZ (UTC, no enclosing brackets)"),
      installationDate: z.string().optional().describe("Installation date in CW format"),
      installedById: z.number().optional().describe("Installed-by member ID"),
      warrantyExpirationDate: z.string().optional().describe("Warranty expiration date in CW format"),
      vendorNotes: z.string().optional().describe("Vendor notes"),
      notes: z.string().optional().describe("Free-text notes"),
      macAddress: z.string().optional().describe("MAC address"),
      lastLoginName: z.string().optional().describe("Last login name"),
      manufacturerId: z.number().optional().describe("Manufacturer company ID"),
      vendorId: z.number().optional().describe("Vendor company ID"),
      ipAddress: z.string().optional().describe("IP address"),
      defaultGateway: z.string().optional().describe("Default gateway"),
      osType: z.string().optional().describe("OS type"),
      osInfo: z.string().optional().describe("OS info text"),
      cpuSpeed: z.string().optional().describe("CPU speed"),
      ram: z.string().optional().describe("RAM"),
      localHardDrives: z.string().optional().describe("Local hard drives info"),
      parentConfigurationId: z.number().optional().describe("Parent configuration ID for hierarchical assets"),
      activeFlag: z.boolean().optional().describe("Active flag"),
      managementLink: z.string().optional().describe("Remote management URL"),
      remoteLink: z.string().optional().describe("Remote access URL"),
      sla: z.object({ id: z.number() }).optional().describe("SLA reference"),
      billFlag: z.boolean().optional().describe("Billing flag"),
      backupSuccesses: z.number().optional().describe("Backup success count"),
      backupIncomplete: z.number().optional().describe("Backup incomplete count"),
      backupFailed: z.number().optional().describe("Backup failed count"),
      backupRestores: z.number().optional().describe("Backup restore count"),
      lastBackupDate: z.string().optional().describe("Last backup date in CW format"),
      backupServerName: z.string().optional().describe("Backup server name"),
      backupBillableSpaceGb: z.number().optional().describe("Backup billable space (GB)"),
      backupProtectedDeviceList: z.string().optional().describe("Backup protected device list"),
      backupYear: z.number().optional().describe("Backup year"),
      backupMonth: z.number().optional().describe("Backup month"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_configuration", entityType: "configuration", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        name: args.name,
        type: { id: args.typeId },
        company: { id: args.companyId },
        status: { id: args.statusId },
      };
      if (args.contactId) body.contact = { id: args.contactId };
      if (args.siteId) body.site = { id: args.siteId };
      if (args.locationId) body.location = { id: args.locationId };
      if (args.businessUnitId) body.businessUnit = { id: args.businessUnitId };
      if (args.deviceIdentifier) body.deviceIdentifier = args.deviceIdentifier;
      if (args.serialNumber) body.serialNumber = args.serialNumber;
      if (args.modelNumber) body.modelNumber = args.modelNumber;
      if (args.tagNumber) body.tagNumber = args.tagNumber;
      if (args.purchaseDate) body.purchaseDate = args.purchaseDate;
      if (args.installationDate) body.installationDate = args.installationDate;
      if (args.installedById) body.installedBy = { id: args.installedById };
      if (args.warrantyExpirationDate) body.warrantyExpirationDate = args.warrantyExpirationDate;
      if (args.vendorNotes) body.vendorNotes = args.vendorNotes;
      if (args.notes) body.notes = args.notes;
      if (args.macAddress) body.macAddress = args.macAddress;
      if (args.lastLoginName) body.lastLoginName = args.lastLoginName;
      if (args.manufacturerId) body.manufacturer = { id: args.manufacturerId };
      if (args.vendorId) body.vendor = { id: args.vendorId };
      if (args.ipAddress) body.ipAddress = args.ipAddress;
      if (args.defaultGateway) body.defaultGateway = args.defaultGateway;
      if (args.osType) body.osType = args.osType;
      if (args.osInfo) body.osInfo = args.osInfo;
      if (args.cpuSpeed) body.cpuSpeed = args.cpuSpeed;
      if (args.ram) body.ram = args.ram;
      if (args.localHardDrives) body.localHardDrives = args.localHardDrives;
      if (args.parentConfigurationId) body.parentConfigurationId = args.parentConfigurationId;
      if (args.activeFlag !== undefined) body.activeFlag = args.activeFlag;
      if (args.managementLink) body.managementLink = args.managementLink;
      if (args.remoteLink) body.remoteLink = args.remoteLink;
      if (args.sla) body.sla = args.sla;
      if (args.billFlag !== undefined) body.billFlag = args.billFlag;
      if (args.backupSuccesses !== undefined) body.backupSuccesses = args.backupSuccesses;
      if (args.backupIncomplete !== undefined) body.backupIncomplete = args.backupIncomplete;
      if (args.backupFailed !== undefined) body.backupFailed = args.backupFailed;
      if (args.backupRestores !== undefined) body.backupRestores = args.backupRestores;
      if (args.lastBackupDate) body.lastBackupDate = args.lastBackupDate;
      if (args.backupServerName) body.backupServerName = args.backupServerName;
      if (args.backupBillableSpaceGb !== undefined) body.backupBillableSpaceGb = args.backupBillableSpaceGb;
      if (args.backupProtectedDeviceList) body.backupProtectedDeviceList = args.backupProtectedDeviceList;
      if (args.backupYear !== undefined) body.backupYear = args.backupYear;
      if (args.backupMonth !== undefined) body.backupMonth = args.backupMonth;

      const result = await client.post("/company/configurations", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_configuration",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a configuration via JSON Patch. Common ops: replace status/id, replace warrantyExpirationDate, replace ipAddress. Use to edit, amend, correct, revise or patch an existing record.",
    {
      id: z.number().describe("Configuration ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_configuration", entityType: "configuration", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/configurations/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_configuration",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a configuration by ID.",
    {
      id: z.number().describe("Configuration ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_configuration", entityType: "configuration", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/configurations/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_bulk_update_configurations",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Bulk-update multiple configurations in a single call. POST to /company/configurations/bulk.",
    {
      configurations: z.array(z.record(z.string(), z.unknown())).describe("Array of full configuration objects to upsert"),
      ...sentinelParams,
    },
    async ({ configurations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_bulk_update_configurations", entityType: "configuration", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post("/company/configurations/bulk", configurations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /company/configurations/{id}/questions (instance answers) ────────────

  server.tool(
    "cw_list_configuration_questions",
    "List the per-instance dynamic question answers stored on a configuration.",
    {
      configurationId: z.number().describe("Parent configuration ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ configurationId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/company/configurations/${configurationId}/questions`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_configuration_question",
    "Get a single per-instance question answer.",
    {
      configurationId: z.number().describe("Parent configuration ID"),
      questionId: z.number().describe("Question answer ID"),
    },
    async ({ configurationId, questionId }) => {
      const result = await client.get(`/company/configurations/${configurationId}/questions/${questionId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_configuration_question",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a per-instance question answer via JSON Patch (typically replace 'answer'). Use to edit, amend, correct, revise or patch an existing record.",
    {
      configurationId: z.number().describe("Parent configuration ID"),
      questionId: z.number().describe("Question answer ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ configurationId, questionId, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_configuration_question", entityType: "configuration_type_question", entityId: questionId, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/configurations/${configurationId}/questions/${questionId}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /company/configurations/types (templates) ────────────────────────────

  server.tool(
    "cw_list_configuration_types",
    "List configuration type definitions (the template surface — Workstation, Server, Firewall, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/company/configurations/types", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_configuration_type",
    "Get a single configuration type by ID.",
    {
      id: z.number().describe("Configuration type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/configurations/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_configuration_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a configuration type (template).",
    {
      name: z.string().describe("Type name"),
      inactiveFlag: z.boolean().optional().describe("Inactive flag"),
      systemFlag: z.boolean().optional().describe("System-managed flag"),
      ...sentinelParams,
    },
    async ({ name, inactiveFlag, systemFlag, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_configuration_type", entityType: "configuration_type", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { name };
      if (inactiveFlag !== undefined) body.inactiveFlag = inactiveFlag;
      if (systemFlag !== undefined) body.systemFlag = systemFlag;
      const result = await client.post("/company/configurations/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_configuration_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a configuration type via JSON Patch. Use to edit, amend, correct, revise or patch an existing record.",
    {
      id: z.number().describe("Configuration type ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_configuration_type", entityType: "configuration_type", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/configurations/types/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_configuration_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a configuration type by ID.",
    {
      id: z.number().describe("Configuration type ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_configuration_type", entityType: "configuration_type", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/configurations/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /company/configurations/types/{id}/questions (template questions) ────

  server.tool(
    "cw_list_configuration_type_questions",
    "List the question template entries on a configuration type (the schema each instance fills in).",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ typeId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/company/configurations/types/${typeId}/questions`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_configuration_type_question",
    "Get a single template question definition.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Question ID"),
    },
    async ({ typeId, questionId }) => {
      const result = await client.get(`/company/configurations/types/${typeId}/questions/${questionId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_configuration_type_question",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a question template entry to a configuration type.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      question: z.string().describe("Question text"),
      fieldType: z.string().describe("Field type ('Text', 'TextArea', 'Date', 'Number', 'EntryField', 'Hyperlink', 'IPAddress', 'Currency', 'Percent', 'Checkbox', 'Password')"),
      requiredFlag: z.boolean().optional().describe("Required flag"),
      inactiveFlag: z.boolean().optional().describe("Inactive flag"),
      sequenceNumber: z.number().optional().describe("Display sequence number"),
      numberOfDecimals: z.number().optional().describe("Number of decimal places (for Number/Currency types)"),
      fieldSize: z.number().optional().describe("Field size in characters"),
      ...sentinelParams,
    },
    async ({ typeId, question, fieldType, requiredFlag, inactiveFlag, sequenceNumber, numberOfDecimals, fieldSize, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_configuration_type_question", entityType: "configuration_type_question", entityId: typeId, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { question, fieldType };
      if (requiredFlag !== undefined) body.requiredFlag = requiredFlag;
      if (inactiveFlag !== undefined) body.inactiveFlag = inactiveFlag;
      if (sequenceNumber !== undefined) body.sequenceNumber = sequenceNumber;
      if (numberOfDecimals !== undefined) body.numberOfDecimals = numberOfDecimals;
      if (fieldSize !== undefined) body.fieldSize = fieldSize;
      const result = await client.post(`/company/configurations/types/${typeId}/questions`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_configuration_type_question",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a question template entry via JSON Patch. Use to edit, amend, correct, revise or patch an existing record.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Question ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ typeId, questionId, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_configuration_type_question", entityType: "configuration_type_question", entityId: questionId, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/configurations/types/${typeId}/questions/${questionId}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_configuration_type_question",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a question template entry from a configuration type.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Question ID"),
      ...sentinelParams,
    },
    async ({ typeId, questionId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_configuration_type_question", entityType: "configuration_type_question", entityId: questionId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/configurations/types/${typeId}/questions/${questionId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /company/configurations/types/{id}/questions/{qid}/values (picklists) ─

  server.tool(
    "cw_list_configuration_type_question_values",
    "List the allowed values (picklist options) for a template question.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Parent question ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ typeId, questionId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/company/configurations/types/${typeId}/questions/${questionId}/values`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_configuration_type_question_value",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add an allowed value (picklist option) to a template question.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Parent question ID"),
      value: z.string().describe("Value text"),
      defaultFlag: z.boolean().optional().describe("Default-selected flag"),
      inactiveFlag: z.boolean().optional().describe("Inactive flag"),
      ...sentinelParams,
    },
    async ({ typeId, questionId, value, defaultFlag, inactiveFlag, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_configuration_type_question_value", entityType: "configuration_type_question_value", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { value };
      if (defaultFlag !== undefined) body.defaultFlag = defaultFlag;
      if (inactiveFlag !== undefined) body.inactiveFlag = inactiveFlag;
      const result = await client.post(`/company/configurations/types/${typeId}/questions/${questionId}/values`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_configuration_type_question_value",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a picklist value via JSON Patch. Use to edit, amend, correct, revise or patch an existing record.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Parent question ID"),
      valueId: z.number().describe("Value ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ typeId, questionId, valueId, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_configuration_type_question_value", entityType: "configuration_type_question_value", entityId: valueId, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/configurations/types/${typeId}/questions/${questionId}/values/${valueId}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_configuration_type_question_value",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a picklist value from a template question.",
    {
      typeId: z.number().describe("Parent configuration type ID"),
      questionId: z.number().describe("Parent question ID"),
      valueId: z.number().describe("Value ID"),
      ...sentinelParams,
    },
    async ({ typeId, questionId, valueId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_configuration_type_question_value", entityType: "configuration_type_question_value", entityId: valueId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/configurations/types/${typeId}/questions/${questionId}/values/${valueId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /company/configurations/statuses ─────────────────────────────────────

  server.tool(
    "cw_list_configuration_statuses",
    "List configuration status definitions (Active, Inactive, Retired, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/company/configurations/statuses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_configuration_status",
    "Get a single configuration status by ID.",
    {
      id: z.number().describe("Configuration status ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/configurations/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_configuration_status",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a configuration status.",
    {
      description: z.string().describe("Status description"),
      closedFlag: z.boolean().optional().describe("Closed/retired flag"),
      defaultFlag: z.boolean().optional().describe("Default flag"),
      inactiveFlag: z.boolean().optional().describe("Inactive flag"),
      ...sentinelParams,
    },
    async ({ description, closedFlag, defaultFlag, inactiveFlag, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_configuration_status", entityType: "configuration_status", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { description };
      if (closedFlag !== undefined) body.closedFlag = closedFlag;
      if (defaultFlag !== undefined) body.defaultFlag = defaultFlag;
      if (inactiveFlag !== undefined) body.inactiveFlag = inactiveFlag;
      const result = await client.post("/company/configurations/statuses", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_configuration_status",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a configuration status via JSON Patch. Use to edit, amend, correct, revise or patch an existing record.",
    {
      id: z.number().describe("Configuration status ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_configuration_status", entityType: "configuration_status", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/company/configurations/statuses/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_configuration_status",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a configuration status by ID.",
    {
      id: z.number().describe("Configuration status ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_configuration_status", entityType: "configuration_status", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/configurations/statuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
