import { AdminForm } from "@/components/admin-form";
import { categoryForm } from "@/data/admin-forms";
export function generateStaticParams(){return ["school-textbooks","childrens-books","competitive-exams","academic-reference","general-reading","writing-supplies","notebooks-paper","school-essentials","art-craft","office-supplies","gifts-return-gifts"].map(slug=>({slug}))}
export default function EditCategory(){return <AdminForm title="Edit subcategory" description="Update its parent department, image, navigation and search presentation." sections={categoryForm(true)} backHref="/admin/categories" />}
