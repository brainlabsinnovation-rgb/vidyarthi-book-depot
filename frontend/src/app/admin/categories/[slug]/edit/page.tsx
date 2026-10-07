import { AdminForm } from "@/components/admin-form";
import { categoryForm } from "@/data/admin-forms";
export function generateStaticParams(){return ["school-textbooks","childrens-books","competitive-exams","academic-reference","general-reading","writing-supplies","notebooks-paper","school-essentials","art-craft","office-supplies","gifts-return-gifts"].map(slug=>({slug}))}
export default async function EditCategory({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <AdminForm title="Edit subcategory" description="Update its department, navigation and search presentation." sections={categoryForm(true)} backHref="/admin/categories" resource="categories" existingSlug={slug} />}
