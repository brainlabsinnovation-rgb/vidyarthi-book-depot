import { AdminForm } from "@/components/admin-form";
import { productForm } from "@/data/admin-forms";
export default function AddProduct(){return <AdminForm title="Add product" description="Create a complete catalog listing with pricing, stock and photos." sections={productForm()} backHref="/admin/products" submitLabel="Add product" />}
