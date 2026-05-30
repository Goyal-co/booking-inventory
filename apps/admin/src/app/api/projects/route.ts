import { NextRequest } from "next/server";
import { GET_projects, POST_projects } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_projects(req);
}

export async function POST(req: Request) {
  return POST_projects(req as import("next/server").NextRequest);
}
