import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";

const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export function registerCatalogTools(server: McpServer, client: CwManageClient) {
  // ===== Catalog items =====

  server.tool(
    "cw_search_catalog_items",
    "Search catalog items (/procurement/catalog). Use 'conditions' for CW query syntax.",
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
      const result = await client.get("/procurement/catalog", {
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
    "cw_get_catalog_item",
    "Get a single catalog item by ID.",
    {
      id: z.number().describe("Catalog item ID"),
      fields: z.string().optional(),
    },
    async ({ id, fields }) => {
      const result = await client.get(`/procurement/catalog/${id}`, { fields });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_count_catalog_items",
    "Count catalog items matching a conditions query.",
    {
      conditions: z.string().optional(),
      childConditions: z.string().optional(),
      customFieldConditions: z.string().optional(),
    },
    async (args) => {
      const result = await client.get("/procurement/catalog/count", args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_catalog_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Create a catalog item. identifier, description, subcategoryId, typeId, and unitOfMeasureId are required.",
    {
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      identifier: z.string().describe("Item identifier / SKU"),
      description: z.string(),
      subcategoryId: z.number().describe("Catalog sub-category ID"),
      typeId: z.number().describe("Catalog item type ID"),
      unitOfMeasureId: z.number().describe("UoM ID"),
      manufacturerId: z.number().optional(),
      manufacturerPartNumber: z.string().optional(),
      vendorId: z.number().optional(),
      vendorSku: z.string().optional(),
      productClass: z.string().optional().describe("NonInventory | Inventory | Bundle | Agreement | Service"),
      cost: z.number().optional(),
      price: z.number().optional(),
      priceAttribute: z.string().optional().describe("Markup | Margin | None"),
      taxableFlag: z.boolean().optional(),
      customerDescription: z.string().optional(),
      notes: z.string().optional(),
      integrationXref: z.string().optional(),
      inactiveFlag: z.boolean().optional(),
      serializedFlag: z.boolean().optional(),
      serializedCostFlag: z.boolean().optional(),
      phaseProductFlag: z.boolean().optional(),
      unitOfMeasureSetId: z.number().optional(),
      productSuppliedFlag: z.boolean().optional(),
      ignoreUpdateFromConvertFlag: z.boolean().optional(),
      isPriceLockedFlag: z.boolean().optional(),
      taxCodeId: z.number().optional(),
      drawingNumber: z.string().optional(),
      uppercut: z.boolean().optional(),
      customFields: z.array(z.object({ id: z.number(), value: z.unknown() })).optional(),
    },
    async (args) => {
      await auditLog({ tool: "cw_create_catalog_item", entityType: "catalog_item", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        identifier: args.identifier,
        description: args.description,
        subcategory: { id: args.subcategoryId },
        type: { id: args.typeId },
        unitOfMeasure: { id: args.unitOfMeasureId },
      };
      if (args.manufacturerId !== undefined) body.manufacturer = { id: args.manufacturerId };
      if (args.manufacturerPartNumber) body.manufacturerPartNumber = args.manufacturerPartNumber;
      if (args.vendorId !== undefined) body.vendor = { id: args.vendorId };
      if (args.vendorSku) body.vendorSku = args.vendorSku;
      if (args.productClass) body.productClass = args.productClass;
      if (args.cost !== undefined) body.cost = args.cost;
      if (args.price !== undefined) body.price = args.price;
      if (args.priceAttribute) body.priceAttribute = args.priceAttribute;
      if (args.taxableFlag !== undefined) body.taxableFlag = args.taxableFlag;
      if (args.customerDescription) body.customerDescription = args.customerDescription;
      if (args.notes) body.notes = args.notes;
      if (args.integrationXref) body.integrationXref = args.integrationXref;
      if (args.inactiveFlag !== undefined) body.inactiveFlag = args.inactiveFlag;
      if (args.serializedFlag !== undefined) body.serializedFlag = args.serializedFlag;
      if (args.serializedCostFlag !== undefined) body.serializedCostFlag = args.serializedCostFlag;
      if (args.phaseProductFlag !== undefined) body.phaseProductFlag = args.phaseProductFlag;
      if (args.unitOfMeasureSetId !== undefined) body.unitOfMeasureSet = { id: args.unitOfMeasureSetId };
      if (args.productSuppliedFlag !== undefined) body.productSuppliedFlag = args.productSuppliedFlag;
      if (args.ignoreUpdateFromConvertFlag !== undefined) body.ignoreUpdateFromConvertFlag = args.ignoreUpdateFromConvertFlag;
      if (args.isPriceLockedFlag !== undefined) body.isPriceLockedFlag = args.isPriceLockedFlag;
      if (args.taxCodeId !== undefined) body.taxCode = { id: args.taxCodeId };
      if (args.drawingNumber) body.drawingNumber = args.drawingNumber;
      if (args.uppercut !== undefined) body.uppercut = args.uppercut;
      if (args.customFields) body.customFields = args.customFields;
      const result = await client.post("/procurement/catalog", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_catalog_item",
    "Update an existing catalog item using JSON Patch operations. " +
      "REQUIRED: you must include 'user_intent' (plain-English description of what " +
      "the user asked for) and 'user_quote' (verbatim text from the user that " +
      "motivated this change). These are logged for audit. If you cannot quote " +
      "the user or articulate their intent, do not call this tool — ask the user first.",
    {
      id: z.number().describe("Catalog item ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to update the price of catalog item 99 to reflect new supplier cost.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this update. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]).describe("Patch operation"),
        path: z.string().describe("JSON path (e.g. 'price', 'cost', 'description')"),
        value: z.unknown().optional().describe("New value"),
      })).describe("Array of JSON Patch operations"),
    },
    async ({ id, user_intent, user_quote, operations }) => {
      await auditLog({ tool: "cw_update_catalog_item", entityType: "catalog_item", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/catalog/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_replace_catalog_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Replace a catalog item via PUT.",
    {
      id: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      body: z.record(z.string(), z.unknown()),
    },
    async ({ id, user_intent, user_quote, body }) => {
      await auditLog({ tool: "cw_replace_catalog_item", entityType: "catalog_item", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("PUT", `/procurement/catalog/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_catalog_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Delete a catalog item. Destructive.",
    {
      id: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_catalog_item", entityType: "catalog_item", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/catalog/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_copy_catalog_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Copy a catalog item to a new item via /procurement/catalog/{id}/copy.",
    {
      id: z.number().describe("Source catalog item ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      identifier: z.string().describe("Identifier for the new copy"),
      description: z.string().optional(),
      includeAllComponentsFlag: z.boolean().optional(),
      includeAllPricingFlag: z.boolean().optional(),
    },
    async (args) => {
      await auditLog({ tool: "cw_copy_catalog_item", entityType: "catalog_item", entityId: args.id, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { identifier: args.identifier };
      if (args.description) body.description = args.description;
      if (args.includeAllComponentsFlag !== undefined) body.includeAllComponentsFlag = args.includeAllComponentsFlag;
      if (args.includeAllPricingFlag !== undefined) body.includeAllPricingFlag = args.includeAllPricingFlag;
      const result = await client.post(`/procurement/catalog/${args.id}/copy`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog item components =====

  server.tool(
    "cw_list_catalog_components",
    "List components under a catalog bundle item.",
    {
      catalogItemId: z.number().describe("Parent catalog item ID"),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
      orderBy: z.string().optional(),
    },
    async ({ catalogItemId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/components`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_catalog_component",
    "Get a single catalog component row.",
    {
      catalogItemId: z.number().describe("Parent catalog item ID"),
      componentId: z.number().describe("Component row ID"),
    },
    async ({ catalogItemId, componentId }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/components/${componentId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_catalog_component",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Add a component to a catalog bundle item.",
    {
      catalogItemId: z.number().describe("Parent catalog item ID"),
      componentCatalogItemId: z.number().describe("Catalog item ID to add as a component"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      quantity: z.number().optional(),
      sequenceNumber: z.number().optional(),
      hidePriceFlag: z.boolean().optional(),
      hideItemIdentifierFlag: z.boolean().optional(),
      hideDescriptionFlag: z.boolean().optional(),
      hideQuantityFlag: z.boolean().optional(),
      hideExtendedPriceFlag: z.boolean().optional(),
    },
    async (args) => {
      await auditLog({ tool: "cw_create_catalog_component", entityType: "catalog_component", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        catalogItem: { id: args.componentCatalogItemId },
      };
      if (args.quantity !== undefined) body.quantity = args.quantity;
      if (args.sequenceNumber !== undefined) body.sequenceNumber = args.sequenceNumber;
      if (args.hidePriceFlag !== undefined) body.hidePriceFlag = args.hidePriceFlag;
      if (args.hideItemIdentifierFlag !== undefined) body.hideItemIdentifierFlag = args.hideItemIdentifierFlag;
      if (args.hideDescriptionFlag !== undefined) body.hideDescriptionFlag = args.hideDescriptionFlag;
      if (args.hideQuantityFlag !== undefined) body.hideQuantityFlag = args.hideQuantityFlag;
      if (args.hideExtendedPriceFlag !== undefined) body.hideExtendedPriceFlag = args.hideExtendedPriceFlag;
      const result = await client.post(`/procurement/catalog/${args.catalogItemId}/components`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_catalog_component",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Update a catalog component row via JSON Patch.",
    {
      catalogItemId: z.number().describe("Parent catalog item ID"),
      componentId: z.number().describe("Component row ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      patch: z.array(patchOp),
    },
    async ({ catalogItemId, componentId, user_intent, user_quote, patch }) => {
      await auditLog({ tool: "cw_update_catalog_component", entityType: "catalog_component", entityId: componentId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/procurement/catalog/${catalogItemId}/components/${componentId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_catalog_component",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Remove a component from a catalog bundle item.",
    {
      catalogItemId: z.number().describe("Parent catalog item ID"),
      componentId: z.number().describe("Component row ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ catalogItemId, componentId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_catalog_component", entityType: "catalog_component", entityId: componentId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/catalog/${catalogItemId}/components/${componentId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog bundled items =====

  server.tool(
    "cw_list_catalog_bundled_items",
    "List items bundled under a catalog item.",
    {
      catalogItemId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ catalogItemId, conditions, page, pageSize }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/bundledItems`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_catalog_bundled_item",
    "Get a single bundled-item row.",
    {
      catalogItemId: z.number(),
      bundledItemId: z.number(),
    },
    async ({ catalogItemId, bundledItemId }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/bundledItems/${bundledItemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_catalog_bundled_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Bundle another catalog item under a catalog item.",
    {
      catalogItemId: z.number().describe("Parent catalog item ID"),
      bundledCatalogItemId: z.number().describe("Catalog item ID to add to the bundle"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      quantity: z.number().optional(),
      sequenceNumber: z.number().optional(),
    },
    async (args) => {
      await auditLog({ tool: "cw_create_catalog_bundled_item", entityType: "catalog_bundled_item", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        catalogItem: { id: args.bundledCatalogItemId },
      };
      if (args.quantity !== undefined) body.quantity = args.quantity;
      if (args.sequenceNumber !== undefined) body.sequenceNumber = args.sequenceNumber;
      const result = await client.post(`/procurement/catalog/${args.catalogItemId}/bundledItems`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_catalog_bundled_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Update a catalog bundled-item row via JSON Patch.",
    {
      catalogItemId: z.number(),
      bundledItemId: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      patch: z.array(patchOp),
    },
    async ({ catalogItemId, bundledItemId, user_intent, user_quote, patch }) => {
      await auditLog({ tool: "cw_update_catalog_bundled_item", entityType: "catalog_bundled_item", entityId: bundledItemId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/procurement/catalog/${catalogItemId}/bundledItems/${bundledItemId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_catalog_bundled_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Remove a bundled item from a catalog item.",
    {
      catalogItemId: z.number(),
      bundledItemId: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ catalogItemId, bundledItemId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_catalog_bundled_item", entityType: "catalog_bundled_item", entityId: bundledItemId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/catalog/${catalogItemId}/bundledItems/${bundledItemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog inventory =====

  server.tool(
    "cw_get_catalog_inventory_on_hand",
    "Get inventory-on-hand rows for a catalog item across warehouses.",
    {
      catalogItemId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ catalogItemId, conditions, page, pageSize }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/inventoryOnHand`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog pricing (item-level price overrides under a schedule) =====

  server.tool(
    "cw_list_catalog_pricing",
    "List per-schedule price overrides on a catalog item.",
    {
      catalogItemId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ catalogItemId, conditions, page, pageSize }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/pricing`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_catalog_pricing",
    "Get a single per-schedule price row on a catalog item.",
    {
      catalogItemId: z.number(),
      pricingId: z.number(),
    },
    async ({ catalogItemId, pricingId }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/pricing/${pricingId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_catalog_pricing",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Add a per-schedule price override to a catalog item.",
    {
      catalogItemId: z.number(),
      pricingScheduleId: z.number().describe("Pricing schedule ID"),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      price: z.number().optional(),
      priceAttribute: z.string().optional().describe("Markup | Margin | None"),
      discount: z.number().optional(),
      markup: z.number().optional(),
    },
    async (args) => {
      await auditLog({ tool: "cw_create_catalog_pricing", entityType: "catalog_pricing", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        priceSchedule: { id: args.pricingScheduleId },
      };
      if (args.price !== undefined) body.price = args.price;
      if (args.priceAttribute) body.priceAttribute = args.priceAttribute;
      if (args.discount !== undefined) body.discount = args.discount;
      if (args.markup !== undefined) body.markup = args.markup;
      const result = await client.post(`/procurement/catalog/${args.catalogItemId}/pricing`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_catalog_pricing",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Update a catalog pricing override via JSON Patch.",
    {
      catalogItemId: z.number(),
      pricingId: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      patch: z.array(patchOp),
    },
    async ({ catalogItemId, pricingId, user_intent, user_quote, patch }) => {
      await auditLog({ tool: "cw_update_catalog_pricing", entityType: "catalog_pricing", entityId: pricingId, userIntent: user_intent, userQuote: user_quote, operations: patch });
      const result = await client.patch(`/procurement/catalog/${catalogItemId}/pricing/${pricingId}`, patch);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_catalog_pricing",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Remove a catalog pricing override.",
    {
      catalogItemId: z.number(),
      pricingId: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ catalogItemId, pricingId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_catalog_pricing", entityType: "catalog_pricing", entityId: pricingId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/catalog/${catalogItemId}/pricing/${pricingId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog item types =====

  server.tool(
    "cw_list_catalog_item_types",
    "List catalog item types.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/procurement/catalog/types", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_catalog_item_type",
    "Get a catalog item type.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/catalog/types/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog sub-categories =====

  server.tool(
    "cw_list_catalog_sub_categories",
    "List catalog sub-categories.",
    {
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/procurement/subcategories", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_catalog_sub_category",
    "Get a catalog sub-category.",
    {
      id: z.number(),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/subcategories/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Catalog manufacturer parts (alt part numbers per item) =====

  server.tool(
    "cw_list_catalog_manufacturer_parts",
    "List manufacturer / vendor part numbers for a catalog item.",
    {
      catalogItemId: z.number(),
      conditions: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    },
    async ({ catalogItemId, conditions, page, pageSize }) => {
      const result = await client.get(`/procurement/catalog/${catalogItemId}/manufacturerPartNumbers`, {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_catalog_manufacturer_part",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Add a manufacturer / vendor part number to a catalog item.",
    {
      catalogItemId: z.number(),
      manufacturerPartNumber: z.string(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
      manufacturerId: z.number().optional(),
      vendorId: z.number().optional(),
      vendorSku: z.string().optional(),
      defaultFlag: z.boolean().optional(),
    },
    async (args) => {
      await auditLog({ tool: "cw_create_catalog_manufacturer_part", entityType: "catalog_manufacturer_part", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        manufacturerPartNumber: args.manufacturerPartNumber,
      };
      if (args.manufacturerId !== undefined) body.manufacturer = { id: args.manufacturerId };
      if (args.vendorId !== undefined) body.vendor = { id: args.vendorId };
      if (args.vendorSku) body.vendorSku = args.vendorSku;
      if (args.defaultFlag !== undefined) body.defaultFlag = args.defaultFlag;
      const result = await client.post(`/procurement/catalog/${args.catalogItemId}/manufacturerPartNumbers`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_catalog_manufacturer_part",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. " +
      "Remove a manufacturer part number row from a catalog item.",
    {
      catalogItemId: z.number(),
      partId: z.number(),
      user_intent: z.string().min(20).describe(
        "Plain-English description of what the user asked for. " +
          "Must be at least 20 characters. Example: " +
          "'User asked to close ticket 12345 because they have billed it.'",
      ),
      user_quote: z.string().min(20).describe(
        "Verbatim quote of the user's actual words that motivated this action. " +
          "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
      ),
    },
    async ({ catalogItemId, partId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_catalog_manufacturer_part", entityType: "catalog_manufacturer_part", entityId: partId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/catalog/${catalogItemId}/manufacturerPartNumbers/${partId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ===== Supporting lookup entities (preserved from prior implementation) =====

  server.tool(
    "cw_list_catalog_categories",
    "List product categories from the ConnectWise catalog.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/procurement/categories", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_catalog_subcategories",
    "List product subcategories from the ConnectWise catalog.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string (e.g. \"category/id=3\")"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25)"),
    },
    async ({ conditions, page, pageSize }) => {
      const result = await client.get("/procurement/subCategories", {
        conditions,
        page: page ?? 1,
        pageSize: pageSize ?? 25,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

}
