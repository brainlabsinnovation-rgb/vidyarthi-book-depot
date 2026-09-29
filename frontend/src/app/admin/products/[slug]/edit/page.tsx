import { AdminForm } from "@/components/admin-form";
import { productForm } from "@/data/admin-forms";
export function generateStaticParams(){return ["a5-spiral-notebooks-pack-4","campus-school-backpack-20l","watercolour-creative-kit","celebration-gift-box"].map(slug=>({slug}))}
export default function EditProduct(){return <AdminForm title="Edit product" description="Update catalog details, pricing, photos, stock and storefront visibility." sections={productForm(true)} backHref="/admin/products" />}
