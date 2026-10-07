import type { AdminFormSection } from "@/components/admin-form";

export const productForm = (editing = false): AdminFormSection[] => [
  { title: "Basic information", description: "What customers will see on the storefront.", fields: [
    { label: "Product name", name: "name", value: editing ? "A5 Spiral Notebooks — Pack of 4" : "", placeholder: "For example A4 ruled notebook", full: true },
    { label: "Short description", name: "short", value: editing ? "200 pages • Ruled • Four colours" : "", placeholder: "One-line product summary", full: true },
    { label: "Full description", name: "description", type: "textarea", value: editing ? "Compact ruled notebooks with smooth paper and durable spiral binding for school, college and everyday notes." : "", placeholder: "Describe the product, its uses and benefits", full: true },
    { label: "Main department", name: "department", type: "select", value: "Stationery", options: ["Books", "Stationery"] },
    { label: "Subcategory", name: "subcategory", type: "select", value: "Notebooks & Paper", options: ["School Textbooks", "Children’s Books", "Competitive Exams", "Academic & Reference", "General Reading", "Writing Supplies", "Notebooks & Paper", "School Essentials", "Art & Craft", "Office Supplies", "Gifts & Return Gifts"] },
    { label: "Brand", name: "brand", placeholder: "Brand name" },
    { label: "SKU", name: "sku", value: editing ? "VBD-NB-104" : "", placeholder: "VBD-XX-000" },
  ]},
  { title: "Pricing and tax", fields: [
    { label: "Selling price (₹)", name: "price", type: "number", value: editing ? "239" : "" },
    { label: "MRP (₹)", name: "mrp", type: "number", value: editing ? "299" : "" },
    { label: "Cost price (₹)", name: "cost", type: "number", help: "Visible only to administrators" },
    { label: "GST rate", name: "gst", type: "select", options: ["0%", "5%", "12%", "18%", "28%"] },
  ]},
  { title: "Inventory and options", fields: [
    { label: "Available quantity", name: "stock", type: "number", value: editing ? "48" : "" },
    { label: "Low-stock warning", name: "lowstock", type: "number", value: "10" },
    { label: "Unit", name: "unit", type: "select", options: ["Piece", "Pack", "Set", "Box", "Dozen"] },
    { label: "Product options", name: "variants", placeholder: "Colour, size, pack quantity" },
    { label: "Track inventory", name: "track", type: "checkbox", value: "true", help: "Reduce stock after every paid order", full: true },
    { label: "Allow ordering when out of stock", name: "backorder", type: "checkbox", help: "Useful for special-order products", full: true },
  ]},
  { title: "Photos and visibility", fields: [
    { label: "Product photos", name: "photos", type: "file", full: true },
    { label: "Image URL", name: "imageUrl", placeholder: "/images/products/example.webp", full: true, help: "Use an existing storefront image until Neon storage is connected." },
    { label: "Status", name: "status", type: "select", options: ["Published", "Draft", "Archived"] },
    { label: "Product badge", name: "badge", placeholder: "Bestseller, New arrival, 20% off" },
    { label: "Feature on homepage", name: "featured", type: "checkbox", full: true },
    { label: "SEO title", name: "seo", placeholder: "Search-friendly title", full: true },
  ]},
];

export const categoryForm = (editing = false): AdminFormSection[] => [
  { title: "Category details", fields: [
    { label: "Category name", name: "name", value: editing ? "School Supplies" : "", placeholder: "Category name" },
    { label: "Parent department", name: "parent", type: "select", options: ["Books", "Stationery"] },
    { label: "Description", name: "description", type: "textarea", value: editing ? "Bags, bottles, notebooks and everyday classroom essentials." : "", full: true },
    { label: "Category image", name: "photo", type: "file", full: true },
    { label: "Image URL", name: "imageUrl", placeholder: "/images/products/example.webp", full: true },
  ]},
  { title: "Storefront display", fields: [
    { label: "Display order", name: "order", type: "number", value: editing ? "1" : "" },
    { label: "URL slug", name: "slug", value: editing ? "school-supplies" : "", placeholder: "school-supplies" },
    { label: "Card colour", name: "color", placeholder: "#fff1d5" },
    { label: "Show in main navigation", name: "nav", type: "checkbox", value: "true", full: true },
    { label: "Feature on homepage", name: "featured", type: "checkbox", value: "true", full: true },
    { label: "Search description", name: "seo", placeholder: "Description shown in search results", full: true },
  ]},
];

export const offerForm = (editing = false): AdminFormSection[] => [
  { title: "Offer information", fields: [
    { label: "Offer name", name: "name", value: editing ? "Back to School" : "", placeholder: "Diwali stationery sale" },
    { label: "Offer code", name: "code", value: editing ? "SCHOOL15" : "", placeholder: "Optional coupon code" },
    { label: "Description", name: "description", type: "textarea", full: true },
    { label: "Offer banner", name: "banner", type: "file", full: true },
  ]},
  { title: "Discount and schedule", fields: [
    { label: "Discount type", name: "type", type: "select", options: ["Percentage", "Fixed amount"] },
    { label: "Discount value", name: "value", type: "number", value: editing ? "15" : "" },
    { label: "Applies to", name: "applies", type: "select", options: ["Entire store", "Selected categories", "Selected products"] },
    { label: "Category or product slugs", name: "target", placeholder: "school-essentials, art-craft", help: "Comma-separated slugs for selected categories or products." },
    { label: "Starts", name: "starts", type: "date" },
    { label: "Ends", name: "ends", type: "date" },
    { label: "Active", name: "active", type: "checkbox", value: "true", full: true },
  ]},
];
