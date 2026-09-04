import { POST_leadSiteVisitOtpVerify } from "@/lib/logged-handlers";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return POST_leadSiteVisitOtpVerify(req as never, ctx);
}
