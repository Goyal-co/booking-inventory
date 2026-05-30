import { GET_users, POST_users, POST_importUsers } from "@/lib/api-handlers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return GET_users(req);
}

export async function POST(req: NextRequest) {
  const body = await req.clone().json();
  if (body.import) return POST_importUsers(req);
  return POST_users(req);
}
