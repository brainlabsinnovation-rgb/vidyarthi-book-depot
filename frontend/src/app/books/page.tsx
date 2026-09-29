import type { Metadata } from "next";
import { DepartmentLanding } from "@/components/department-landing";
import { bookSubcategories, productsByDepartment } from "@/data/catalog";
export const metadata: Metadata = { title: "Books" };
export default function BooksPage(){return <DepartmentLanding department="books" title="Books" intro="Discover school textbooks, children’s stories, competitive-exam guides, academic references and general reading in one dedicated department." subcategories={bookSubcategories} products={productsByDepartment("books")} />}
