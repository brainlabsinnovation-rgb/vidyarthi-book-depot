import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CustomerAuthProvider } from "@/components/customer-auth-provider";
import { ShopProvider } from "@/components/shop-provider";
import { SiteChrome } from "@/components/site-chrome";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = { title: { default: "Vidyarthi Book Depot", template: "%s | Vidyarthi Book Depot" }, description: "Books, stationery, school supplies, art materials, gifts and return gifts—all in one happy place." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={manrope.variable}><CustomerAuthProvider><ShopProvider><SiteChrome>{children}</SiteChrome></ShopProvider></CustomerAuthProvider></body></html>;
}
