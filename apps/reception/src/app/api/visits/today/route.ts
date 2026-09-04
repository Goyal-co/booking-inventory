import { GET_visitsToday } from "@/lib/logged-handlers";

export async function GET() {
  return GET_visitsToday();
}
