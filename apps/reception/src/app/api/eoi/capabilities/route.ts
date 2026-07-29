import { GET_eoiCapabilities } from "@/lib/api-handlers";

export async function GET() {
  return GET_eoiCapabilities();
}
