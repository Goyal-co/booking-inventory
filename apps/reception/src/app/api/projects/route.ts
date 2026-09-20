import { GET_projects } from "@/lib/logged-handlers";

export async function GET() {
  return GET_projects();
}
