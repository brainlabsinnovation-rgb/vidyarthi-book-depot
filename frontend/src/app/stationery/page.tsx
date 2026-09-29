import type { Metadata } from "next";
import { DepartmentLanding } from "@/components/department-landing";
import { productsByDepartment, stationerySubcategories } from "@/data/catalog";
export const metadata: Metadata = { title: "Stationery" };
export default function StationeryPage(){return <DepartmentLanding department="stationery" title="Stationery" intro="Shop writing supplies, notebooks, school essentials, art materials, office products, gifts and return gifts from one dedicated department." subcategories={stationerySubcategories} products={productsByDepartment("stationery")} />}
