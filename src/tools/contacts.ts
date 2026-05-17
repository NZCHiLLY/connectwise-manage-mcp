import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

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

export function registerContactTools(server: McpServer, client: CwManageClient) {
  // ===== Contacts =====

  server.tool(
    "cw_search_contacts",
    "Search contacts. Use 'conditions' for CW query syntax (e.g. \"firstName='Jane'\").",
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
      fields: z.string().optional(),
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
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
    },
    async (args) => {
      const result = await client.get("/company/contacts/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact",
    "Create a new contact. firstName is required; companyId associates the contact with a company.",
    {
      firstName: z.string().describe("First name (required)"),
      lastName: z.string().optional(),
      companyId: z.number().optional().describe("Company ID this contact belongs to"),
      siteId: z.number().optional().describe("Site ID"),
      title: z.string().optional(),
      typeId: z.number().optional().describe("Contact type ID"),
      departmentId: z.number().optional().describe("Contact department ID"),
      relationshipId: z.number().optional(),
      defaultPhoneNbr: z.string().optional(),
      defaultPhoneType: z.string().optional().describe("Direct, Mobile, Fax, etc."),
      defaultPhoneExtension: z.string().optional(),
      defaultBillingFlag: z.boolean().optional(),
      defaultFlag: z.boolean().optional(),
      inactiveFlag: z.boolean().optional(),
      marriedFlag: z.boolean().optional(),
      childrenFlag: z.boolean().optional(),
      portalSecurityLevelId: z.number().optional(),
      disablePortalLoginFlag: z.boolean().optional(),
      unsubscribeFlag: z.boolean().optional(),
      communicationItems: z.array(communicationItem).optional().describe("Phone/email/fax items"),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
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
    "Update a contact via JSON Patch.",
    {
      id: z.number().describe("Contact ID"),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/company/contacts/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_contact",
    "Replace a contact via PUT.",
    {
      id: z.number().describe("Contact ID"),
      body: z.record(z.string(), z.unknown()).describe("Full contact body"),
    },
    async ({ id, body }) => {
      const result = await client.request("PUT", `/company/contacts/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact",
    "Delete a contact. Destructive.",
    {
      id: z.number().describe("Contact ID"),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/company/contacts/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Contact communications =====

  server.tool(
    "cw_list_contact_communications",
    "List communication items (phone, email, fax) for a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
    "Add a communication item to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      typeId: z.number().describe("Communication type ID (Direct, Mobile, Email, Fax, etc.)"),
      value: z.string().describe("The phone number / email / fax value"),
      extension: z.string().optional(),
      defaultFlag: z.boolean().optional(),
      communicationType: z.string().optional().describe("'Phone' | 'Email' | 'Fax'"),
    },
    async (args) => {
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
    "Update a contact communication item via JSON Patch.",
    {
      contactId: z.number().describe("Contact ID"),
      communicationId: z.number().describe("Communication item ID"),
      patch: z.array(patchOp),
    },
    async ({ contactId, communicationId, patch }) => {
      const result = await client.patch(`/company/contacts/${contactId}/communications/${communicationId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_communication",
    "Delete a contact communication item.",
    {
      contactId: z.number().describe("Contact ID"),
      communicationId: z.number().describe("Communication item ID"),
    },
    async ({ contactId, communicationId }) => {
      const result = await client.request("DELETE", `/company/contacts/${contactId}/communications/${communicationId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Contact notes =====

  server.tool(
    "cw_list_contact_notes",
    "List notes on a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      noteId: z.number().describe("Note ID"),
    },
    async ({ contactId, noteId }) => {
      const result = await client.get(`/company/contacts/${contactId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_contact_note",
    "Add a note to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      text: z.string().describe("Note text"),
      typeId: z.number().optional(),
      flagged: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { text: args.text };
      if (args.typeId !== undefined) body.type = { id: args.typeId };
      if (args.flagged !== undefined) body.flagged = args.flagged;
      const result = await client.post(`/company/contacts/${args.contactId}/notes`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_contact_note",
    "Update a contact note via JSON Patch.",
    {
      contactId: z.number().describe("Contact ID"),
      noteId: z.number().describe("Note ID"),
      patch: z.array(patchOp),
    },
    async ({ contactId, noteId, patch }) => {
      const result = await client.patch(`/company/contacts/${contactId}/notes/${noteId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_note",
    "Delete a contact note.",
    {
      contactId: z.number().describe("Contact ID"),
      noteId: z.number().describe("Note ID"),
    },
    async ({ contactId, noteId }) => {
      const result = await client.request("DELETE", `/company/contacts/${contactId}/notes/${noteId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Contact tracks =====

  server.tool(
    "cw_list_contact_tracks",
    "List marketing tracks assigned to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
    "Assign a marketing track to a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      trackId: z.number().describe("Track ID"),
      startDate: z.string().optional().describe("Start date in [YYYY-MM-DDTHH:MM:SSZ] format"),
    },
    async (args) => {
      const body: Record<string, unknown> = { track: { id: args.trackId } };
      if (args.startDate) body.startDate = args.startDate;
      const result = await client.post(`/company/contacts/${args.contactId}/tracks`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_track",
    "Remove a track assignment from a contact.",
    {
      contactId: z.number().describe("Contact ID"),
      trackEntryId: z.number().describe("Contact-track row ID"),
    },
    async ({ contactId, trackEntryId }) => {
      const result = await client.request("DELETE", `/company/contacts/${contactId}/tracks/${trackEntryId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Contact catalog: types, departments, relationships, communication types, portal security =====

  server.tool(
    "cw_list_contact_types",
    "List contact type definitions.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
    "Create a contact type.",
    {
      description: z.string().describe("Type name"),
      defaultFlag: z.boolean().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { description: args.description };
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      const result = await client.post("/company/contacts/types", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_contact_type",
    "Update a contact type via JSON Patch.",
    {
      id: z.number(),
      patch: z.array(patchOp),
    },
    async ({ id, patch }) => {
      const result = await client.patch(`/company/contacts/types/${id}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_contact_type",
    "Delete a contact type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.request("DELETE", `/company/contacts/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_contact_departments",
    "List contact departments.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      id: z.number(),
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
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
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
