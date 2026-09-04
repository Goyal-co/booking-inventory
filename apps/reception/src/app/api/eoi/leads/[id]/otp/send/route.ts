import { POST_eoiSiteVisitOtpSend } from "@/lib/logged-handlers";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return POST_eoiSiteVisitOtpSend(req as never, ctx);
}
