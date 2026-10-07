import { AdminForm } from "@/components/admin-form";
import { categoryForm } from "@/data/admin-forms";
export default function AddCategory(){return <AdminForm title="Add category" description="Create a category or subcategory for products and navigation." sections={categoryForm()} backHref="/admin/categories" submitLabel="Add category" resource="categories" />}
