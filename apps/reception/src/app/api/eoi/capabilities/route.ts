import { GET_eoiCapabilities } from "@/lib/logged-handlers";

export async function GET() {
  return GET_eoiCapabilities();
}
