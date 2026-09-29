import Link from "next/link";
import { SearchX } from "lucide-react";
export default function NotFound(){return <section className="section"><div className="shell empty-state"><SearchX/><span className="kicker">Page not found</span><h1>We could not find that shelf.</h1><p>The page may have moved, or the product may no longer be available in this preview.</p><div className="success-actions"><Link className="button primary" href="/">Return home</Link><Link className="button secondary" href="/shop">Browse products</Link></div></div></section>}
