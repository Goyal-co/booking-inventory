import { NextRequest } from "next/server";
import { GET_pricingDefaults, PATCH_pricingDefaults } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_pricingDefaults(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH_pricingDefaults(req, ctx);
}
