import { GET_audit } from "@/lib/api-handlers";

export async function GET() {
  return GET_audit();
}
