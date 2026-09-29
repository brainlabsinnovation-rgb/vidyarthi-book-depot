import { AdminForm } from "@/components/admin-form";
import { offerForm } from "@/data/admin-forms";
export default function AddOffer(){return <AdminForm title="Create offer" description="Configure a product, category or occasion-based promotion." sections={offerForm()} backHref="/admin/offers" submitLabel="Create offer" />}
