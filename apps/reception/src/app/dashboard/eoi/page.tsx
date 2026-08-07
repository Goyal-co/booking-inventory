import { redirect } from "next/navigation";

/** EOI CRM list removed — Partner Portal + CRM hits show in Check-in search. */
export default function EoiLeadsRedirectPage() {
  redirect("/dashboard");
}
