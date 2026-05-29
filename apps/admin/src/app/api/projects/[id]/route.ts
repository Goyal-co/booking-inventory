import { NextRequest } from "next/server";
import { GET_project, PATCH_project, DELETE_project, POST_floorPlan, POST_costSheet, POST_tower, POST_filterConfig } from "@/lib/api-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_project(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH_project(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_project(req, ctx);
}
