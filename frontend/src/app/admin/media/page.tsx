"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImagePlus, Search, UploadCloud } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";

type MediaItem = { kind: string; ownerSlug: string; path: string; alt: string; bucket: string | null };

export default function Media() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/admin/media", { signal: controller.signal, credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Media records could not be loaded")))
      .then((data) => setItems(data.items))
      .catch((reason) => { if (reason?.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);
  const visible = items.filter((item) => `${item.ownerSlug} ${item.path}`.toLowerCase().includes(query.toLowerCase()));
  return <AdminShell title="Media library" description={error || "Product and category image references saved in PostgreSQL."}><div className="admin-toolbar"><div><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search media" /></div><button className="button primary" disabled title="Neon storage credentials are required"><UploadCloud /> Upload after storage setup</button></div><section className="admin-panel media-panel"><div className="media-grid">{visible.map((item, index) => <div className="media-entry" key={`${item.kind}-${item.ownerSlug}-${index}`}>{item.path.startsWith("/images/") ? <Image src={item.path} alt={item.alt || item.ownerSlug} width={240} height={180} /> : <ImagePlus aria-hidden="true" />}<span>{item.ownerSlug.replaceAll("-", " ")}</span></div>)}</div>{items.length === 0 && <p className="muted-copy">No media records yet. Image upload will be enabled after Neon storage is configured.</p>}</section></AdminShell>;
}
