import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

const communicationItem = z.object({
  type: z.object({ id: z.number() }).optional(),
  value: z.string(),
  extension: z.string().optional(),
  defaultFlag: z.boolean().optional(),
  communicationType: z.string().optional(),
});

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

export function registerContactTools(server: McpServer, client: CwManageClient) {
  // ── Contacts ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_search_contacts",
    "Search contacts. Use 'conditions' for CW query syntax (e.g. \"firstName='Jane'\").",
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
      const result = await client.get("/company/contacts", {
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
    "cw_get_contact",
    "Get a single contact by ID.",
    {
      id: z.number().describe("Contact ID"),
      fields: z.string().optional().describe("Comma-separated list of fields to return"),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/company/contacts/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_contacts",
    "Count contacts matching a conditions query.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      childConditions: z.string().optional().describe("Child object conditions query string"),
      customFieldConditions: z.string().optional().describe("Custom field conditions query string"),
    },
    async (args) => {
      const result = await client.get("/company/contacts/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a new contact. firstName is required; companyId associates the contact with a company.",
    {
      firstName: z.string().describe("Contact first name"),
      lastName: z.string().optional().describe("Contact last name"),
      companyId: z.number().optional().describe("Company ID"),
      siteId: z.number().optional().describe("Site ID"),
      title: z.string().optional().describe("Job title"),
      typeId: z.number().optional().describe("Contact type ID"),
      departmentId: z.number().optional().describe("Contact department ID"),
      relationshipId: z.number().optional().describe("Contact relationship ID"),
      defaultPhoneNbr: z.string().optional().describe("Default phone number"),
      defaultPhoneType: z.string().optional().describe("Direct, Mobile, Fax, etc."),
      defaultPhoneExtension: z.string().optional().describe("Default phone extension"),
      defaultBillingFlag: z.boolean().optional().describe("Mark as default billing contact"),
      defaultFlag: z.boolean().optional().describe("Mark as default"),
      inactiveFlag: z.boolean().optional().describe("Mark as inactive"),
      marriedFlag: z.boolean().optional().describe("Mark contact as married"),
      childrenFlag: z.boolean().optional().describe("Mark contact as having children"),
      portalSecurityLevelId: z.number().optional().describe("Portal security level ID"),
      disablePortalLoginFlag: z.boolean().optional().describe("Disable portal login for contact"),
      unsubscribeFlag: z.boolean().optional().describe("Unsubscribe contact from marketing"),
      communicationItems: z.array(communicationItem).optional().describe("Phone/email/fax items"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional().describe("Custom field values"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_contact", entityType: "contact", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { firstName: args.firstName };
      if (args.lastName) body.lastName = args.lastName;
      if (args.companyId !== undefined) body.company = { id: args.companyId };
      if (args.siteId !== undefined) body.site = { id: args.siteId };
      if (args.title) body.title = args.title;
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.departmentId !== undefined) body.department = { id: args.departmentId };
      if (args.relationshipId !== undefined) body.relationship = { id: args.relationshipId };
      if (args.defaultPhoneNbr) body.defaultPhoneNbr = args.defaultPhoneNbr;
      if (args.defaultPhoneType) body.defaultPhoneType = args.defaultPhoneType;
      if (args.defaultPhoneExtension) body.defaultPhoneExtension = args.defaultPhoneExtension;
      if (args.defaultBillingFlag !== undefined) body.defaultBillingFlag = args.defaultBillingFlag;
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.marriedFlag !== undefined) body.marriedFlag = args.marriedFlag;
      if (args.childrenFlag !== undefined) body.childrenFlag = args.childrenFlag;
      if (args.portalSecurityLevelId !== undefined) body.portalSecurityLevel = { id: args.portalSecurityLevelId };
      if (args.disablePortalLoginFlag !== undefined) body.disablePortalLoginFlag = args.disablePortalLoginFlag;
      if (args.unsubscribeFlag !== undefined) body.unsubscribeFlag = args.unsubscribeFlag;
      if (args.communicationItems) body.communicationItems = args.communicationItems;
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/company/contacts", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a contact via JSON Patch.",
    {
      id: z.number().describe("Contact ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ id, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_contact", entityType: "contact", entityId: id, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/company/contacts/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Replace a contact via PUT.",
    {
      id: z.number().describe("Contact ID"),
      body: z.record(z.string(), z.unknown()).describe("Full replacement body for PUT"),
      ...sentinelParams,
    },
    async ({ id, body, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_replace_contact", entityType: "contact", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("PUT", `/company/contacts/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a contact. Destructive.",
    {
      id: z.number().describe("Contact ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_contact", entityType: "contact", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/contacts/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Contact communications ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_contact_communications",
    "List communication items (phone, email, fax) for a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ contactId, conditions, page, pageSize }) => {
      const result = await client.get(`/company/contacts/${contactId}/communications`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_contact_communication",
    "Get a single communication item.",
    {
      contactId: z.number().describe("Contact ID"),
      communicationId: z.number().describe("Communication item ID"),
    },
    async ({ contactId, communicationId }) => {
      const result = await client.get(`/company/contacts/${contactId}/communications/${communicationId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact_communication",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a communication item to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      typeId: z.number().describe("Communication type ID (Direct, Mobile, Email, Fax, etc.)"),
      value: z.string().describe("The phone number / email / fax value"),
      extension: z.string().optional().describe("Phone extension"),
      defaultFlag: z.boolean().optional().describe("Mark as default"),
      communicationType: z.string().optional().describe("'Phone' | 'Email' | 'Fax'"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_contact_communication", entityType: "contact_communication", entityId: args.contactId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        type: { id: args.typeId },
        value: args.value,
      };
      if (args.extension) body.extension = args.extension;
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      if (args.communicationType) body.communicationType = args.communicationType;
      const result = await client.post(`/company/contacts/${args.contactId}/communications`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_contact_communication",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a contact communication item via JSON Patch.",
    {
      contactId: z.number().describe("Contact ID"),
      communicationId: z.number().describe("Communication item ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ contactId, communicationId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_contact_communication", entityType: "contact_communication", entityId: communicationId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/company/contacts/${contactId}/communications/${communicationId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_communication",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a contact communication item.",
    {
      contactId: z.number().describe("Contact ID"),
      communicationId: z.number().describe("Communication item ID"),
      ...sentinelParams,
    },
    async ({ contactId, communicationId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_contact_communication", entityType: "contact_communication", entityId: communicationId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/contacts/${contactId}/communications/${communicationId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Contact notes ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_contact_notes",
    "List notes on a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ contactId, conditions, page, pageSize }) => {
      const result = await client.get(`/company/contacts/${contactId}/notes`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_contact_note",
    "Get a single contact note.",
    {
      contactId: z.number().describe("Contact ID"),
      noteId: z.number().describe("Contact note ID"),
    },
    async ({ contactId, noteId }) => {
      const result = await client.get(`/company/contacts/${contactId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a note to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      text: z.string().describe("Note text"),
      typeId: z.number().optional().describe("Note type ID"),
      flagged: z.boolean().optional().describe("Flag this note for attention"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_contact_note", entityType: "contact_note", entityId: args.contactId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/company/contacts/${args.contactId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_contact_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a contact note via JSON Patch.",
    {
      contactId: z.number().describe("Contact ID"),
      noteId: z.number().describe("Contact note ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ contactId, noteId, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_contact_note", entityType: "contact_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/company/contacts/${contactId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_note",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a contact note.",
    {
      contactId: z.number().describe("Contact ID"),
      noteId: z.number().describe("Contact note ID"),
      ...sentinelParams,
    },
    async ({ contactId, noteId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_contact_note", entityType: "contact_note", entityId: noteId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/contacts/${contactId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Contact tracks ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_contact_tracks",
    "List marketing tracks assigned to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ contactId, conditions, page, pageSize }) => {
      const result = await client.get(`/company/contacts/${contactId}/tracks`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_add_contact_track",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Assign a marketing track to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      trackId: z.number().describe("Contact track ID"),
      startDate: z.string().optional().describe("Start date in [YYYY-MM-DDTHH:MM:SSZ] format"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_add_contact_track", entityType: "contact_track", entityId: args.contactId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { track: { id: args.trackId } };
      if (args.startDate) body.startDate = args.startDate;
      const result = await client.post(`/company/contacts/${args.contactId}/tracks`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_track",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Remove a track assignment from a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      trackEntryId: z.number().describe("Contact-track row ID"),
      ...sentinelParams,
    },
    async ({ contactId, trackEntryId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_contact_track", entityType: "contact_track", entityId: trackEntryId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/contacts/${contactId}/tracks/${trackEntryId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── Contact catalog: types, departments, relationships, communication types, portal security ─────────────────────────────────────────────────────────────────

  server.tool(
    "cw_list_contact_types",
    "List contact type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/contacts/types", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_contact_type",
    "Get a contact type.",
    {
      id: z.number().describe("Type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/contacts/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a contact type.",
    {
      description: z.string().describe("Type name"),
      defaultFlag: z.boolean().optional().describe("Mark as default"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_contact_type", entityType: "contact_type", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { description: args.description };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      const result = await client.post("/company/contacts/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_contact_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a contact type via JSON Patch.",
    {
      id: z.number().describe("Contact type ID"),
      patch: z.array(patchOp).describe("JSON Patch operations to apply"),
      ...sentinelParams,
    },
    async ({ id, patch, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_contact_type", entityType: "contact_type", entityId: id, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/company/contacts/types/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_type",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a contact type.",
    {
      id: z.number().describe("Contact type ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_contact_type", entityType: "contact_type", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/company/contacts/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_contact_departments",
    "List contact departments.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/contacts/departments", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_contact_department",
    "Get a contact department.",
    {
      id: z.number().describe("Contact department ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/company/contacts/departments/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_contact_relationships",
    "List contact relationships.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/contacts/relationships", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_communication_types",
    "List communication-type definitions (Direct, Mobile, Email, Fax, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/communicationTypes", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_portal_security_levels",
    "List portal security levels (drives self-service permissions for client-portal access).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/portalSecurities", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_contact_tracks_catalog",
    "List marketing track definitions (the catalog, not the per-contact assignments).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/company/tracks", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
