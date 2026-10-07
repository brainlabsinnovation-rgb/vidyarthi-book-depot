import type { Metadata } from "next";
import { DepartmentLanding } from "@/components/department-landing";
import { getCategories, getProducts } from "@/lib/catalog-api";
export const metadata: Metadata = { title: "Stationery" };
export default async function StationeryPage(){const [subcategories, result] = await Promise.all([getCategories("stationery"), getProducts({ department: "stationery", limit: 48 })]);return <DepartmentLanding department="stationery" title="Stationery" intro="Shop writing supplies, notebooks, school essentials, art materials, office products, gifts and return gifts from one dedicated department." subcategories={subcategories} products={result.items} total={result.total} />}
