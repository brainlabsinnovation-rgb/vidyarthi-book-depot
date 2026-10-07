import { CustomerAuthForm } from "@/components/customer-auth-form";
import { safeReturnPath } from "@/lib/customer-auth";
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <CustomerAuthForm mode="login" nextPath={safeReturnPath(params.next)} />;
}
