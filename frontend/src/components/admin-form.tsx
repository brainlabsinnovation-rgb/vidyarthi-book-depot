"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Save, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "./admin-shell";

type SelectOption = string | { label: string; value: string };
export type AdminField = { label: string; name: string; type?: "text" | "number" | "textarea" | "select" | "date" | "time" | "file" | "checkbox"; placeholder?: string; value?: string; options?: SelectOption[]; full?: boolean; help?: string };
export type AdminFormSection = { title: string; description?: string; fields: AdminField[] };
type Resource = "products" | "categories" | "offers";
type CategoryRecord = { slug: string; name: string; department: string; color?: string; imageUrl?: string };
type ExistingRecord = Record<string, unknown>;

function displayValues(resource: Resource, record: ExistingRecord): Record<string, string> {
  if (resource === "products") return {
    name: String(record.name ?? ""), short: String(record.short ?? ""), description: String(record.description ?? ""),
    department: record.department === "books" ? "Books" : "Stationery", subcategory: String(record.categorySlug ?? ""),
    brand: String(record.brand ?? ""), sku: String(record.sku ?? ""), price: String(record.price ?? ""),
    mrp: String(record.mrp ?? ""), cost: String(record.cost ?? ""), gst: `${Number(record.taxRateBps ?? 0) / 100}%`,
    stock: String(record.stock ?? 0), lowstock: String(record.lowStockThreshold ?? 0), unit: String(record.unit ?? "Piece"),
    status: record.status === "active" ? "Published" : record.status === "archived" ? "Archived" : "Draft",
    badge: String(record.badge ?? ""), featured: String(Boolean(record.featured)), backorder: String(Boolean(record.allowBackorder)),
    seo: String(record.seoTitle ?? ""), imageUrl: String(record.imageUrl ?? ""),
  };
  if (resource === "offers") return {
    name: String(record.name ?? ""), code: String(record.code ?? ""), description: String(record.description ?? ""),
    type: record.discountType === "fixed" ? "Fixed amount" : "Percentage", value: String(record.discountValue ?? ""),
    applies: Array.isArray(record.productSlugs) && record.productSlugs.length ? "Selected products" : Array.isArray(record.categorySlugs) && record.categorySlugs.length ? "Selected categories" : "Entire store",
    target: [...(Array.isArray(record.productSlugs) ? record.productSlugs : []), ...(Array.isArray(record.categorySlugs) ? record.categorySlugs : [])].join(", "),
    starts: String(record.startsAt ?? "").slice(0, 10), ends: String(record.endsAt ?? "").slice(0, 10),
    active: String(Boolean(record.active)),
  };
  return {
    name: String(record.name ?? ""), parent: record.department === "books" ? "Books" : "Stationery",
    description: String(record.description ?? ""), order: String(record.sortOrder ?? 0), slug: String(record.slug ?? ""),
    nav: String(Boolean(record.showInNavigation)), featured: String(Boolean(record.featured)),
    seo: String(record.seoDescription ?? ""), imageUrl: String(record.imageUrl ?? ""), color: String(record.color ?? ""),
  };
}

export function AdminForm({ title, description, sections, backHref, submitLabel = "Save changes", resource, existingSlug }: {
  title: string; description: string; sections: AdminFormSection[]; backHref: string; submitLabel?: string;
  resource?: Resource; existingSlug?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(resource && existingSlug));
  const [error, setError] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [record, setRecord] = useState<ExistingRecord | null>(null);

  useEffect(() => {
    if (!resource) return;
    const controller = new AbortController();
    const requests: Promise<void>[] = [];
    if (resource === "products") requests.push(fetch("/api/store/admin/categories", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Categories could not be loaded")))
      .then((data) => setCategories(data.items)));
    if (existingSlug) requests.push(fetch(`/api/store/admin/${resource}/${encodeURIComponent(existingSlug)}`, { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Record could not be loaded")))
      .then((data) => setRecord(data)));
    Promise.all(requests).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, existingSlug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resource) { setSaved(true); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (files.length) { setError("Image upload needs the shop’s Neon storage credentials. Save the record without files for now."); return; }
    const form = new FormData(event.currentTarget);
    const get = (name: string) => String(form.get(name) ?? "").trim();
    const number = (name: string) => Number(get(name) || 0);
    let payload: Record<string, unknown>;
    if (resource === "products") {
      payload = {
        name: get("name"), categorySlug: get("subcategory"), sku: get("sku") || null,
        short: get("short"), description: get("description"), price: number("price"), mrp: number("mrp"),
        cost: get("cost") ? number("cost") : null, stock: number("stock"), lowStockThreshold: number("lowstock"),
        brand: get("brand") || null, unit: get("unit").toLowerCase(), taxRateBps: Math.round(parseFloat(get("gst") || "0") * 100),
        status: get("status") === "Published" ? "active" : get("status") === "Archived" ? "archived" : "draft",
        badge: get("badge") || null, featured: form.has("featured"), allowBackorder: form.has("backorder"),
        seoTitle: get("seo") || null, imageUrl: get("imageUrl") || null,
      };
    } else if (resource === "categories") {
      payload = {
        name: get("name"), slug: get("slug") || undefined,
        department: get("parent").toLowerCase(), description: get("description"),
        sortOrder: number("order"), showInNavigation: form.has("nav"), featured: form.has("featured"),
        seoDescription: get("seo"), active: true,
        imageUrl: get("imageUrl") || null, color: get("color") || null,
      };
    } else {
      if (!get("starts") || !get("ends")) { setError("Choose the start and end dates for the offer."); return; }
      const targets = get("target").split(",").map((item) => item.trim()).filter(Boolean);
      payload = {
        name: get("name"), code: get("code") || null, description: get("description"),
        discountType: get("type") === "Fixed amount" ? "fixed" : "percentage",
        discountValue: number("value"),
        startsAt: new Date(`${get("starts")}T00:00:00+05:30`).toISOString(),
        endsAt: new Date(`${get("ends")}T23:59:59+05:30`).toISOString(),
        active: form.has("active"),
        productSlugs: get("applies") === "Selected products" ? targets : [],
        categorySlugs: get("applies") === "Selected categories" ? targets : [],
      };
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/store/admin/${resource}${existingSlug ? `/${encodeURIComponent(existingSlug)}` : ""}`, {
        method: existingSlug ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Could not save this record");
      }
      router.push(backHref);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this record"); }
    finally { setSaving(false); }
  }

  const values = resource && record ? displayValues(resource, record) : {};
  if (loading) return <AdminShell title={title} description={description}><p>Loading record…</p></AdminShell>;
  return <AdminShell title={title} description={description}><form className="admin-form-layout" onSubmit={submit}><div className="admin-form-main">
    {error && <div className="demo-success" role="alert"><span><strong>Could not save</strong><small>{error}</small></span></div>}
    {saved && <div className="demo-success"><CheckCircle2 /><span><strong>Preview saved locally</strong><small>This section is still a demo; no database changes were made.</small></span></div>}
    {sections.map((section) => <section className="admin-panel form-panel" key={section.title}><div className="panel-heading"><h2>{section.title}</h2>{section.description && <p>{section.description}</p>}</div><div className="admin-form-grid">{section.fields.map((field) => {
      const options: SelectOption[] = resource === "products" && field.name === "subcategory" && categories.length
        ? categories.map((category) => ({ label: `${category.department === "books" ? "Books" : "Stationery"} · ${category.name}`, value: category.slug }))
        : field.options ?? [];
      const value = values[field.name] ?? field.value ?? "";
      return <label className={`${field.full ? "full" : ""} ${field.type === "checkbox" ? "check-field" : ""}`} key={field.name}>
        {field.type === "checkbox" ? <><input name={field.name} type="checkbox" defaultChecked={value === "true"} /><span><strong>{field.label}</strong>{field.help && <small>{field.help}</small>}</span></> : <><span>{field.label}</span>
          {field.type === "textarea" ? <textarea name={field.name} defaultValue={value} placeholder={field.placeholder} rows={5} />
            : field.type === "select" ? <select key={options.map((option) => typeof option === "string" ? option : option.value).join("|")} name={field.name} defaultValue={value}>{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : field.type === "file" ? <div className="file-drop"><ImagePlus /><strong>Choose images or drag them here</strong><small>Upload will be enabled after Neon storage is connected</small><input name={field.name} type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).map((file) => file.name))} /></div>
            : <input name={field.name} type={field.type || "text"} defaultValue={value} placeholder={field.placeholder} />}
          {field.help && <small>{field.help}</small>}{field.type === "file" && files.length > 0 && <div className="file-list"><UploadCloud /> {files.join(", ")}</div>}</>}
      </label>;
    })}</div></section>)}
  </div><aside className="admin-save-card"><h3>Ready to publish?</h3><p>Review the details, visibility and pricing before saving.</p><button className="button primary" type="submit" disabled={saving}><Save /> {saving ? "Saving…" : submitLabel}</button><Link className="button secondary" href={backHref}>Cancel</Link><small>{resource ? "Product and category details save to PostgreSQL when connected." : "This section is a preview and does not save to the database."}</small></aside></form></AdminShell>;
}
