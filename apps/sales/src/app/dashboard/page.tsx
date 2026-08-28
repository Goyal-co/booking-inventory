import { redirect } from "next/navigation";
import { getCustomerDashboardUrl } from "@booking/database";

/** Forward dashboard links that land on the sales host to the customer app. */
export default async function SalesDashboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token?.trim()) {
    redirect("/login");
  }
  redirect(getCustomerDashboardUrl(token.trim()));
}
