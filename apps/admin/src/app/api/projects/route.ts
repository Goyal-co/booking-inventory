import { GET_projects, POST_projects } from "@/lib/api-handlers";

export async function GET() {
  return GET_projects();
}

export async function POST(req: Request) {
  return POST_projects(req as import("next/server").NextRequest);
}
