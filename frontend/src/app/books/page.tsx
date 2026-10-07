import type { Metadata } from "next";
import { DepartmentLanding } from "@/components/department-landing";
import { getCategories, getProducts } from "@/lib/catalog-api";
export const metadata: Metadata = { title: "Books" };
export default async function BooksPage(){const [subcategories, result] = await Promise.all([getCategories("books"), getProducts({ department: "books", limit: 48 })]);return <DepartmentLanding department="books" title="Books" intro="Discover school textbooks, children’s stories, competitive-exam guides, academic references and general reading in one dedicated department." subcategories={subcategories} products={result.items} total={result.total} />}
