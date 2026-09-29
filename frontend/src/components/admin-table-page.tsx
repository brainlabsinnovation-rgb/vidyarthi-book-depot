"use client";

import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "./admin-shell";
export function AdminTablePage({ title, description, columns, rows, button = "Add new", actionHref, rowHrefs }: { title: string; description: string; columns: string[]; rows: string[][]; button?: string; actionHref?: string; rowHrefs?: string[] }) {
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) => row.some((cell) => cell.toLowerCase().includes(query.toLowerCase()))), [query, rows]);
  const action=actionHref ? <Link className="button primary" href={actionHref}><Plus /> {button}</Link> : undefined;
  return <AdminShell title={title} description={description} action={action}><div className="admin-toolbar"><div><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title.toLowerCase()}`} /></div><span className="admin-table-count">{visibleRows.length} records</span></div><section className="admin-panel admin-table-wrap"><table><thead><tr>{columns.map((column)=><th key={column}>{column}</th>)}{rowHrefs && <th>Actions</th>}</tr></thead><tbody>{visibleRows.map(({row,index})=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{columns[cellIndex]?.toLowerCase()==="status" ? <span className={`status ${cell.toLowerCase().replaceAll(" ", "-")}`}>{cell}</span> : cell}</td>)}{rowHrefs && <td><Link className="table-action" href={rowHrefs[index]}>View <ChevronRight /></Link></td>}</tr>)}</tbody></table>{visibleRows.length===0 && <div className="admin-table-empty"><strong>No matching records</strong><span>Try a different search term.</span></div>}</section></AdminShell>;
}
