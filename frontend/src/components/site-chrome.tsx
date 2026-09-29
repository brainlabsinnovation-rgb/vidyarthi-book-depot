"use client";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
export function SiteChrome({children}:{children:React.ReactNode}){const pathname=usePathname();if(pathname.startsWith("/admin"))return <main>{children}</main>;return <><SiteHeader/><main>{children}</main><SiteFooter/><MobileNav/></>}
