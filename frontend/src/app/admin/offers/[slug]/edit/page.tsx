import { AdminForm } from "@/components/admin-form";
import { offerForm } from "@/data/admin-forms";
export function generateStaticParams(){return ["back-to-school","creative-week","return-gift-value"].map(slug=>({slug}))}
export default function EditOffer(){return <AdminForm title="Edit offer" description="Update discount rules, products, dates and storefront visibility." sections={offerForm(true)} backHref="/admin/offers" />}
