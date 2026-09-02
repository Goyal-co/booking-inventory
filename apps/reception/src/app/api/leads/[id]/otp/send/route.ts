import { POST_leadSiteVisitOtpSend } from "@/lib/api-handlers";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return POST_leadSiteVisitOtpSend(req as never, ctx);
}
