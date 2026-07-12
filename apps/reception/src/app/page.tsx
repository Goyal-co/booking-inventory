import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(new URL("/dashboard", process.env.NEXTAUTH_URL ?? "http://localhost:3004"));
}
