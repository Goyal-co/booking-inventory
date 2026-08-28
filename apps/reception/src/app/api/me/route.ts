import { GET_me } from "@/lib/api-handlers";

export async function GET() {
  return GET_me();
}
