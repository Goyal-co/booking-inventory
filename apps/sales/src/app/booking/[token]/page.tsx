import { redirect } from "next/navigation";
import { getCustomerBookingUrl } from "@booking/database";

/** Sales app has no booking form — forward mistaken / old email links to the customer app. */
export default async function SalesBookingRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(getCustomerBookingUrl(token));
}
