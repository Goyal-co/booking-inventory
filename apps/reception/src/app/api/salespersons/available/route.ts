import { GET_availableSalespersons } from "@/lib/api-handlers";

export async function GET() {
  return GET_availableSalespersons();
}
