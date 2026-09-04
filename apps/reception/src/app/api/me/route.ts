import { GET_me } from "@/lib/logged-handlers";

export async function GET() {
  return GET_me();
}
