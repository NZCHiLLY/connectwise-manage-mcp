import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { auditLog } from "../audit/log.js";
import { sentinelParams } from "./shared.js";

/**
 * Procurement tools — covers /procurement subtree.
 * Products catalogue (NOT the same as /company/configurations), purchase orders
 * with submit/unsubmit/email actions, RMA references, warehouses, pricing
 * schedules, shipment methods, units, and adjustments.
 */
export function registerProcurementTools(server: McpServer, client: CwManageClient) {
  // ── /procurement/products ────────────────────────────────────────────────

  server.tool(
    "cw_search_products",
    "Search procurement products (catalog instances on tickets / projects / agreements). Distinct from /company/configurations.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/products", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_product",
    "Get a single procurement product instance by ID.",
    {
      id: z.number().describe("Product ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/products/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_product",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a product instance (places a catalog item onto a ticket / project / agreement / opportunity).",
    {
      catalogItemId: z.number().describe("Catalog item ID from /procurement/catalog"),
      quantity: z.number().describe("Quantity"),
      price: z.number().optional().describe("Unit price override"),
      cost: z.number().optional().describe("Unit cost override"),
      billableOption: z.string().optional().describe("'Billable', 'DoNotBill', or 'NoCharge'"),
      ticketId: z.number().optional().describe("Service ticket ID to attach to"),
      projectId: z.number().optional().describe("Project ID to attach to"),
      phaseId: z.number().optional().describe("Project phase ID to attach to"),
      agreementId: z.number().optional().describe("Agreement ID to attach to"),
      opportunityId: z.number().optional().describe("Opportunity ID to attach to"),
      salesOrderId: z.number().optional().describe("Sales order ID to attach to"),
      companyId: z.number().optional().describe("Company ID"),
      vendorId: z.number().optional().describe("Vendor company ID"),
      vendorSku: z.string().optional().describe("Vendor SKU"),
      serialNumber: z.string().optional().describe("Serial number"),
      taxableFlag: z.boolean().optional().describe("Taxable?"),
      dropshipFlag: z.boolean().optional().describe("Dropship flag"),
      specialOrderFlag: z.boolean().optional().describe("Special-order flag"),
      description: z.string().optional().describe("Description override"),
      customerDescription: z.string().optional().describe("Customer-facing description"),
      internalNotes: z.string().optional().describe("Internal notes"),
      warehouseId: z.number().optional().describe("Source warehouse ID"),
      warehouseBinId: z.number().optional().describe("Source warehouse bin ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_product", entityType: "product", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        catalogItem: { id: args.catalogItemId },
        quantity: args.quantity,
      };
      if (args.price !== undefined) body.price = args.price;
      if (args.cost !== undefined) body.cost = args.cost;
      if (args.billableOption) body.billableOption = args.billableOption;
      if (args.ticketId) body.chargeToId = args.ticketId, body.chargeToType = "Ticket";
      if (args.projectId) body.project = { id: args.projectId };
      if (args.phaseId) body.phase = { id: args.phaseId };
      if (args.agreementId) body.agreement = { id: args.agreementId };
      if (args.opportunityId) body.opportunity = { id: args.opportunityId };
      if (args.salesOrderId) body.salesOrder = { id: args.salesOrderId };
      if (args.companyId) body.company = { id: args.companyId };
      if (args.vendorId) body.vendor = { id: args.vendorId };
      if (args.vendorSku) body.vendorSku = args.vendorSku;
      if (args.serialNumber) body.serialNumber = args.serialNumber;
      if (args.taxableFlag !== undefined) body.taxableFlag = args.taxableFlag;
      if (args.dropshipFlag !== undefined) body.dropshipFlag = args.dropshipFlag;
      if (args.specialOrderFlag !== undefined) body.specialOrderFlag = args.specialOrderFlag;
      if (args.description) body.description = args.description;
      if (args.customerDescription) body.customerDescription = args.customerDescription;
      if (args.internalNotes) body.internalNotes = args.internalNotes;
      if (args.warehouseId) body.warehouse = { id: args.warehouseId };
      if (args.warehouseBinId) body.warehouseBin = { id: args.warehouseBinId };

      const result = await client.post("/procurement/products", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_product",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a product instance via JSON Patch.",
    {
      id: z.number().describe("Product ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_product", entityType: "product", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/products/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_product",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a product instance by ID.",
    {
      id: z.number().describe("Product ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_product", entityType: "product", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/products/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_product_components",
    "List the component sub-products that build up a kit/bundle product instance.",
    {
      productId: z.number().describe("Parent product ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ productId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/procurement/products/${productId}/components`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_product_picking_shipping_detail",
    "Get the picking / shipping details for a product instance.",
    {
      productId: z.number().describe("Parent product ID"),
      detailId: z.number().describe("Picking-shipping detail ID"),
    },
    async ({ productId, detailId }) => {
      const result = await client.get(`/procurement/products/${productId}/pickingShippingDetails/${detailId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_product_picking_shipping_details",
    "List picking / shipping detail rows for a product instance.",
    {
      productId: z.number().describe("Parent product ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ productId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/procurement/products/${productId}/pickingShippingDetails`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/purchaseorders ──────────────────────────────────────────

  server.tool(
    "cw_search_purchase_orders",
    "Search purchase orders. Use 'conditions' for CW query syntax (e.g. \"status/name = 'Open' and vendorCompany/id = 17\").",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/purchaseorders", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_purchase_order",
    "Get a single purchase order by ID.",
    {
      id: z.number().describe("Purchase order ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/purchaseorders/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_purchase_order",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a purchase order.",
    {
      vendorCompanyId: z.number().describe("Vendor company ID"),
      statusId: z.number().describe("PO status ID"),
      poNumber: z.string().optional().describe("Vendor PO number override"),
      vendorContactId: z.number().optional().describe("Vendor contact ID"),
      shipToCompanyId: z.number().optional().describe("Ship-to company ID"),
      shipToContactId: z.number().optional().describe("Ship-to contact ID"),
      shipToSiteId: z.number().optional().describe("Ship-to site ID"),
      billToCompanyId: z.number().optional().describe("Bill-to company ID"),
      billToContactId: z.number().optional().describe("Bill-to contact ID"),
      billToSiteId: z.number().optional().describe("Bill-to site ID"),
      warehouseId: z.number().optional().describe("Default warehouse ID"),
      warehouseBinId: z.number().optional().describe("Default warehouse bin ID"),
      taxCodeId: z.number().optional().describe("Tax code ID"),
      termsId: z.number().optional().describe("Billing terms ID"),
      shipmentMethodId: z.number().optional().describe("Shipment method ID"),
      currencyId: z.number().optional().describe("Currency ID"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      dateOrdered: z.string().optional().describe("Order date in CW format: [YYYY-MM-DDTHH:MM:SSZ]"),
      shipmentDate: z.string().optional().describe("Expected ship date in CW format"),
      vendorOrderNumber: z.string().optional().describe("Vendor's order number"),
      notes: z.string().optional().describe("Free-text notes"),
      taxFreightFlag: z.boolean().optional().describe("Apply tax to freight"),
      freightCost: z.number().optional().describe("Freight cost"),
      freightTaxableFlag: z.boolean().optional().describe("Freight taxable"),
      reconciledFlag: z.boolean().optional().describe("Reconciled flag"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_purchase_order", entityType: "purchase_order", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        vendorCompany: { id: args.vendorCompanyId },
        status: { id: args.statusId },
      };
      if (args.poNumber) body.poNumber = args.poNumber;
      if (args.vendorContactId) body.vendorContact = { id: args.vendorContactId };
      if (args.shipToCompanyId) body.shipToCompany = { id: args.shipToCompanyId };
      if (args.shipToContactId) body.shipToContact = { id: args.shipToContactId };
      if (args.shipToSiteId) body.shipToSite = { id: args.shipToSiteId };
      if (args.billToCompanyId) body.billToCompany = { id: args.billToCompanyId };
      if (args.billToContactId) body.billToContact = { id: args.billToContactId };
      if (args.billToSiteId) body.billToSite = { id: args.billToSiteId };
      if (args.warehouseId) body.warehouse = { id: args.warehouseId };
      if (args.warehouseBinId) body.warehouseBin = { id: args.warehouseBinId };
      if (args.taxCodeId) body.taxCode = { id: args.taxCodeId };
      if (args.termsId) body.terms = { id: args.termsId };
      if (args.shipmentMethodId) body.shipmentMethod = { id: args.shipmentMethodId };
      if (args.currencyId) body.currency = { id: args.currencyId };
      if (args.locationId) body.location = { id: args.locationId };
      if (args.businessUnitId) body.businessUnit = { id: args.businessUnitId };
      if (args.dateOrdered) body.dateOrdered = args.dateOrdered;
      if (args.shipmentDate) body.shipmentDate = args.shipmentDate;
      if (args.vendorOrderNumber) body.vendorOrderNumber = args.vendorOrderNumber;
      if (args.notes) body.notes = args.notes;
      if (args.taxFreightFlag !== undefined) body.taxFreightFlag = args.taxFreightFlag;
      if (args.freightCost !== undefined) body.freightCost = args.freightCost;
      if (args.freightTaxableFlag !== undefined) body.freightTaxableFlag = args.freightTaxableFlag;
      if (args.reconciledFlag !== undefined) body.reconciledFlag = args.reconciledFlag;

      const result = await client.post("/procurement/purchaseorders", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_purchase_order",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a purchase order via JSON Patch.",
    {
      id: z.number().describe("Purchase order ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_purchase_order", entityType: "purchase_order", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/purchaseorders/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_purchase_order",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a purchase order by ID.",
    {
      id: z.number().describe("Purchase order ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_purchase_order", entityType: "purchase_order", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/purchaseorders/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_submit_purchase_order",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Submit a purchase order — moves status from Draft past the approval gate. POST to /procurement/purchaseorders/{id}/submit.",
    {
      id: z.number().describe("Purchase order ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_submit_purchase_order", entityType: "purchase_order", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/procurement/purchaseorders/${id}/submit`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_unsubmit_purchase_order",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Unsubmit a purchase order — returns it to Draft. POST to /procurement/purchaseorders/{id}/unsubmit.",
    {
      id: z.number().describe("Purchase order ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_unsubmit_purchase_order", entityType: "purchase_order", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.post(`/procurement/purchaseorders/${id}/unsubmit`, {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_email_purchase_order",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Email a purchase order to a recipient. POST to /procurement/purchaseorders/{id}/emailPO.",
    {
      id: z.number().describe("Purchase order ID"),
      to: z.string().optional().describe("Comma-separated recipient email addresses"),
      cc: z.string().optional().describe("Comma-separated CC email addresses"),
      bcc: z.string().optional().describe("Comma-separated BCC email addresses"),
      subject: z.string().optional().describe("Email subject override"),
      body: z.string().optional().describe("Email body override"),
      ...sentinelParams,
    },
    async ({ id, to, cc, bcc, subject, body: emailBody, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_email_purchase_order", entityType: "purchase_order", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {};
      if (to) body.to = to;
      if (cc) body.cc = cc;
      if (bcc) body.bcc = bcc;
      if (subject) body.subject = subject;
      if (emailBody) body.body = emailBody;
      const result = await client.post(`/procurement/purchaseorders/${id}/emailPO`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/purchaseorders/{id}/lineitems ───────────────────────────

  server.tool(
    "cw_list_purchase_order_line_items",
    "List line items on a purchase order.",
    {
      poId: z.number().describe("Parent purchase order ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ poId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/procurement/purchaseorders/${poId}/lineitems`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_purchase_order_line_item",
    "Get a single purchase order line item by ID.",
    {
      poId: z.number().describe("Parent purchase order ID"),
      lineItemId: z.number().describe("Line item ID"),
    },
    async ({ poId, lineItemId }) => {
      const result = await client.get(`/procurement/purchaseorders/${poId}/lineitems/${lineItemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_purchase_order_line_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a line item to a purchase order.",
    {
      poId: z.number().describe("Parent purchase order ID"),
      productId: z.number().describe("Catalog item / product ID"),
      quantity: z.number().describe("Quantity"),
      unitCost: z.number().optional().describe("Unit cost override"),
      vendorSku: z.string().optional().describe("Vendor SKU"),
      description: z.string().optional().describe("Description override"),
      receivedFlag: z.boolean().optional().describe("Received flag"),
      receivedQuantity: z.number().optional().describe("Received quantity"),
      cancelFlag: z.boolean().optional().describe("Cancel flag"),
      cancelledQuantity: z.number().optional().describe("Cancelled quantity"),
      backorderFlag: z.boolean().optional().describe("Backordered flag"),
      backorderedQuantity: z.number().optional().describe("Backordered quantity"),
      productClass: z.string().optional().describe("Product class"),
      warehouseId: z.number().optional().describe("Destination warehouse ID"),
      warehouseBinId: z.number().optional().describe("Destination warehouse bin ID"),
      shipToCompanyId: z.number().optional().describe("Ship-to company ID"),
      shipToContactId: z.number().optional().describe("Ship-to contact ID"),
      shipToSiteId: z.number().optional().describe("Ship-to site ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_purchase_order_line_item", entityType: "purchase_order_line_item", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        product: { id: args.productId },
        quantity: args.quantity,
      };
      if (args.unitCost !== undefined) body.unitCost = args.unitCost;
      if (args.vendorSku) body.vendorSku = args.vendorSku;
      if (args.description) body.description = args.description;
      if (args.receivedFlag !== undefined) body.receivedFlag = args.receivedFlag;
      if (args.receivedQuantity !== undefined) body.receivedQuantity = args.receivedQuantity;
      if (args.cancelFlag !== undefined) body.cancelFlag = args.cancelFlag;
      if (args.cancelledQuantity !== undefined) body.cancelledQuantity = args.cancelledQuantity;
      if (args.backorderFlag !== undefined) body.backorderFlag = args.backorderFlag;
      if (args.backorderedQuantity !== undefined) body.backorderedQuantity = args.backorderedQuantity;
      if (args.productClass) body.productClass = args.productClass;
      if (args.warehouseId) body.warehouse = { id: args.warehouseId };
      if (args.warehouseBinId) body.warehouseBin = { id: args.warehouseBinId };
      if (args.shipToCompanyId) body.shipToCompany = { id: args.shipToCompanyId };
      if (args.shipToContactId) body.shipToContact = { id: args.shipToContactId };
      if (args.shipToSiteId) body.shipToSite = { id: args.shipToSiteId };

      const result = await client.post(`/procurement/purchaseorders/${args.poId}/lineitems`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_purchase_order_line_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a purchase order line item via JSON Patch. Common ops: replace receivedQuantity, replace receivedFlag.",
    {
      poId: z.number().describe("Parent purchase order ID"),
      lineItemId: z.number().describe("Line item ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ poId, lineItemId, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_purchase_order_line_item", entityType: "purchase_order_line_item", entityId: lineItemId, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/purchaseorders/${poId}/lineitems/${lineItemId}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_purchase_order_line_item",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a purchase order line item.",
    {
      poId: z.number().describe("Parent purchase order ID"),
      lineItemId: z.number().describe("Line item ID"),
      ...sentinelParams,
    },
    async ({ poId, lineItemId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_purchase_order_line_item", entityType: "purchase_order_line_item", entityId: lineItemId, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/purchaseorders/${poId}/lineitems/${lineItemId}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/purchaseOrderStatuses ───────────────────────────────────

  server.tool(
    "cw_list_purchase_order_statuses",
    "List purchase order status definitions (Draft, Open, Submitted, Closed, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/purchaseOrderStatuses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_purchase_order_status",
    "Get a single purchase order status by ID.",
    {
      id: z.number().describe("Status ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/purchaseOrderStatuses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/rmaActions ──────────────────────────────────────────────

  server.tool(
    "cw_list_rma_actions",
    "List RMA action definitions (Refund, Replace, Repair, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/rmaActions", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_rma_dispositions",
    "List RMA disposition definitions (the post-return outcome — e.g. Restock, Scrap, Returned to Vendor).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/rmaDispositions", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_rma_statuses",
    "List RMA status definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/rmaStatuses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/warehouses ──────────────────────────────────────────────

  server.tool(
    "cw_list_warehouses",
    "List warehouses.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/warehouses", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_warehouse",
    "Get a single warehouse by ID.",
    {
      id: z.number().describe("Warehouse ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/warehouses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_warehouse",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a warehouse.",
    {
      name: z.string().describe("Warehouse name"),
      defaultFlag: z.boolean().optional().describe("Default warehouse?"),
      inactiveFlag: z.boolean().optional().describe("Inactive?"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      ...sentinelParams,
    },
    async ({ name, defaultFlag, inactiveFlag, locationId, businessUnitId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_warehouse", entityType: "warehouse", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = { name };
      if (defaultFlag !== undefined) body.defaultFlag = defaultFlag;
      if (inactiveFlag !== undefined) body.inactiveFlag = inactiveFlag;
      if (locationId) body.location = { id: locationId };
      if (businessUnitId) body.businessUnit = { id: businessUnitId };
      const result = await client.post("/procurement/warehouses", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_warehouse",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a warehouse via JSON Patch.",
    {
      id: z.number().describe("Warehouse ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_warehouse", entityType: "warehouse", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/warehouses/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_warehouse",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a warehouse by ID.",
    {
      id: z.number().describe("Warehouse ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_warehouse", entityType: "warehouse", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/warehouses/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/warehouseBins ───────────────────────────────────────────

  server.tool(
    "cw_list_warehouse_bins",
    "List warehouse bins (storage locations within warehouses).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/warehouseBins", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_warehouse_bin",
    "Get a single warehouse bin by ID.",
    {
      id: z.number().describe("Warehouse bin ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/warehouseBins/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_warehouse_bin",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a warehouse bin.",
    {
      name: z.string().describe("Bin name"),
      warehouseId: z.number().describe("Parent warehouse ID"),
      defaultFlag: z.boolean().optional().describe("Default bin?"),
      inactiveFlag: z.boolean().optional().describe("Inactive?"),
      ...sentinelParams,
    },
    async ({ name, warehouseId, defaultFlag, inactiveFlag, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_warehouse_bin", entityType: "warehouse_bin", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {
        name,
        warehouse: { id: warehouseId },
      };
      if (defaultFlag !== undefined) body.defaultFlag = defaultFlag;
      if (inactiveFlag !== undefined) body.inactiveFlag = inactiveFlag;
      const result = await client.post("/procurement/warehouseBins", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_warehouse_bin",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a warehouse bin via JSON Patch.",
    {
      id: z.number().describe("Warehouse bin ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_warehouse_bin", entityType: "warehouse_bin", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/warehouseBins/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_warehouse_bin",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a warehouse bin by ID.",
    {
      id: z.number().describe("Warehouse bin ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_warehouse_bin", entityType: "warehouse_bin", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/warehouseBins/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/pricingSchedules ────────────────────────────────────────

  server.tool(
    "cw_list_pricing_schedules",
    "List pricing schedule definitions (price-list overrides per customer / agreement / volume).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/pricingSchedules", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_pricing_schedule",
    "Get a single pricing schedule by ID.",
    {
      id: z.number().describe("Pricing schedule ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/pricingSchedules/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_pricing_schedule",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create a pricing schedule.",
    {
      name: z.string().describe("Pricing schedule name"),
      typeId: z.number().optional().describe("Pricing schedule type ID"),
      discountFlag: z.boolean().optional().describe("Discount flag"),
      hideDescriptionFlag: z.boolean().optional().describe("Hide description flag"),
      hideExtendedPriceFlag: z.boolean().optional().describe("Hide extended price flag"),
      hideItemIdentifierFlag: z.boolean().optional().describe("Hide item identifier flag"),
      hideQuantityFlag: z.boolean().optional().describe("Hide quantity flag"),
      hidePriceFlag: z.boolean().optional().describe("Hide price flag"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_pricing_schedule", entityType: "pricing_schedule", entityId: 0, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = { name: args.name };
      if (args.typeId) body.type = { id: args.typeId };
      if (args.discountFlag !== undefined) body.discountFlag = args.discountFlag;
      if (args.hideDescriptionFlag !== undefined) body.hideDescriptionFlag = args.hideDescriptionFlag;
      if (args.hideExtendedPriceFlag !== undefined) body.hideExtendedPriceFlag = args.hideExtendedPriceFlag;
      if (args.hideItemIdentifierFlag !== undefined) body.hideItemIdentifierFlag = args.hideItemIdentifierFlag;
      if (args.hideQuantityFlag !== undefined) body.hideQuantityFlag = args.hideQuantityFlag;
      if (args.hidePriceFlag !== undefined) body.hidePriceFlag = args.hidePriceFlag;
      if (args.locationId) body.location = { id: args.locationId };
      if (args.businessUnitId) body.businessUnit = { id: args.businessUnitId };
      const result = await client.post("/procurement/pricingSchedules", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_pricing_schedule",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update a pricing schedule via JSON Patch.",
    {
      id: z.number().describe("Pricing schedule ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_pricing_schedule", entityType: "pricing_schedule", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/pricingSchedules/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_pricing_schedule",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete a pricing schedule by ID.",
    {
      id: z.number().describe("Pricing schedule ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_pricing_schedule", entityType: "pricing_schedule", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/pricingSchedules/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/pricingSchedules/{id}/detailedPricing (tiers) ───────────

  server.tool(
    "cw_list_pricing_schedule_details",
    "List the per-item detailed pricing entries within a pricing schedule.",
    {
      scheduleId: z.number().describe("Parent pricing schedule ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ scheduleId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/procurement/pricingSchedules/${scheduleId}/detailedPricing`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/shipmentMethods ─────────────────────────────────────────

  server.tool(
    "cw_list_shipment_methods",
    "List shipment method definitions (UPS, FedEx, DHL, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/shipmentMethods", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_shipment_method",
    "Get a single shipment method by ID.",
    {
      id: z.number().describe("Shipment method ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/shipmentMethods/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/unitOfMeasures ──────────────────────────────────────────

  server.tool(
    "cw_list_unit_of_measures",
    "List unit-of-measure definitions (Each, Box, Hour, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/unitOfMeasures", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_unit_of_measure",
    "Get a single unit of measure by ID.",
    {
      id: z.number().describe("Unit of measure ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/unitOfMeasures/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/adjustments ─────────────────────────────────────────────

  server.tool(
    "cw_list_adjustments",
    "List inventory adjustments.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/adjustments", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_adjustment",
    "Get a single inventory adjustment by ID.",
    {
      id: z.number().describe("Adjustment ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/adjustments/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_adjustment",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Create an inventory adjustment header.",
    {
      typeId: z.number().describe("Adjustment type ID"),
      identifier: z.string().describe("Adjustment identifier"),
      reason: z.string().optional().describe("Reason text"),
      notes: z.string().optional().describe("Notes"),
      locationId: z.number().optional().describe("Location ID"),
      businessUnitId: z.number().optional().describe("Business unit ID"),
      ...sentinelParams,
    },
    async ({ typeId, identifier, reason, notes, locationId, businessUnitId, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_create_adjustment", entityType: "adjustment", entityId: 0, userIntent: user_intent, userQuote: user_quote });
      const body: Record<string, unknown> = {
        type: { id: typeId },
        identifier,
      };
      if (reason) body.reason = reason;
      if (notes) body.notes = notes;
      if (locationId) body.location = { id: locationId };
      if (businessUnitId) body.businessUnit = { id: businessUnitId };
      const result = await client.post("/procurement/adjustments", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_update_adjustment",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Update an adjustment via JSON Patch.",
    {
      id: z.number().describe("Adjustment ID"),
      operations: z.array(z.object({
        op: z.enum(["replace", "add", "remove"]),
        path: z.string(),
        value: z.unknown().optional(),
      })).describe("Array of JSON Patch operations"),
      ...sentinelParams,
    },
    async ({ id, operations, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_update_adjustment", entityType: "adjustment", entityId: id, userIntent: user_intent, userQuote: user_quote, operations });
      const result = await client.patch(`/procurement/adjustments/${id}`, operations);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_delete_adjustment",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Delete an adjustment by ID.",
    {
      id: z.number().describe("Adjustment ID"),
      ...sentinelParams,
    },
    async ({ id, user_intent, user_quote }) => {
      await auditLog({ tool: "cw_delete_adjustment", entityType: "adjustment", entityId: id, userIntent: user_intent, userQuote: user_quote });
      const result = await client.request("DELETE", `/procurement/adjustments/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_adjustment_details",
    "List the per-item detail lines of an adjustment.",
    {
      adjustmentId: z.number().describe("Parent adjustment ID"),
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ adjustmentId, conditions, page, pageSize, orderBy }) => {
      const result = await client.get(`/procurement/adjustments/${adjustmentId}/details`, {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_create_adjustment_detail",
    "SENTINEL: requires user_intent + user_quote — only call if you have explicit user instruction. Add a detail line (single product movement) to an adjustment.",
    {
      adjustmentId: z.number().describe("Parent adjustment ID"),
      catalogItemId: z.number().describe("Catalog item ID"),
      quantityOnHand: z.number().describe("Current on-hand quantity"),
      quantityAdjusted: z.number().describe("Quantity to adjust (+ to add, − to remove)"),
      warehouseId: z.number().describe("Warehouse ID"),
      warehouseBinId: z.number().describe("Warehouse bin ID"),
      unitCost: z.number().optional().describe("Unit cost"),
      serialNumber: z.string().optional().describe("Serial number"),
      notes: z.string().optional().describe("Notes"),
      ...sentinelParams,
    },
    async (args) => {
      await auditLog({ tool: "cw_create_adjustment_detail", entityType: "adjustment", entityId: args.adjustmentId, userIntent: args.user_intent, userQuote: args.user_quote });
      const body: Record<string, unknown> = {
        catalogItem: { id: args.catalogItemId },
        quantityOnHand: args.quantityOnHand,
        quantityAdjusted: args.quantityAdjusted,
        warehouse: { id: args.warehouseId },
        warehouseBin: { id: args.warehouseBinId },
      };
      if (args.unitCost !== undefined) body.unitCost = args.unitCost;
      if (args.serialNumber) body.serialNumber = args.serialNumber;
      if (args.notes) body.notes = args.notes;
      const result = await client.post(`/procurement/adjustments/${args.adjustmentId}/details`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_adjustment_types",
    "List adjustment type definitions.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/adjustmentTypes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_get_adjustment_type",
    "Get a single adjustment type by ID.",
    {
      id: z.number().describe("Adjustment type ID"),
    },
    async ({ id }) => {
      const result = await client.get(`/procurement/adjustmentTypes/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/manufacturers ───────────────────────────────────────────

  server.tool(
    "cw_list_manufacturers",
    "List manufacturers in the procurement catalog.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/manufacturers", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ── /procurement/categories & subCategories ──────────────────────────────

  server.tool(
    "cw_list_product_categories",
    "List product categories in the procurement catalog.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/categories", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_product_sub_categories",
    "List product sub-categories.",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/subCategories", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cw_list_product_types",
    "List product type definitions (Inventory, Non-Inventory, Service, etc.).",
    {
      conditions: z.string().optional().describe("ConnectWise conditions query string"),
      page: z.number().optional().describe("Page number (default: 1)"),
      pageSize: z.number().optional().describe("Results per page (default: 25, max: 1000)"),
      orderBy: z.string().optional().describe("Field to order by"),
    },
    async ({ conditions, page, pageSize, orderBy }) => {
      const result = await client.get("/procurement/productTypes", {
        conditions, page: page ?? 1, pageSize: pageSize ?? 25, orderBy,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
