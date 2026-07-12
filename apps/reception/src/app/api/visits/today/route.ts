import { GET_visitsToday } from "@/lib/api-handlers";

export async function GET() {
  return GET_visitsToday();
}
