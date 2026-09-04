import { NextRequest } from "next/server";
import { GET_projects } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_projects(req);
}
