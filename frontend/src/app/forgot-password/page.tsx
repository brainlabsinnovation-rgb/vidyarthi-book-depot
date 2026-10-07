import { CustomerPasswordReset } from "@/components/customer-password-reset";
import { CustomerPhoneRecovery } from "@/components/customer-phone-recovery";
import { safeReturnPath } from "@/lib/customer-auth";
export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ next?: string; method?: string }> }) {
  const params = await searchParams;
  if (params.method === "phone") return <CustomerPhoneRecovery nextPath={safeReturnPath(params.next)} />;
  return <CustomerPasswordReset nextPath={safeReturnPath(params.next)} />;
}
