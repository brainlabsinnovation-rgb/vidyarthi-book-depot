import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand ${compact ? "compact" : ""}`} aria-label="Vidhyarthi Book Depot home"><span className="brand-logo-frame"><Image className="brand-logo-image" src="/images/vidyarthi-logo-clean.png" alt="Vidhyarthi" width={compact ? 90 : 108} height={compact ? 60 : 72} priority={!compact} /></span><span className="brand-copy"><span>books <i>•</i> stationery</span></span></Link>;
}
