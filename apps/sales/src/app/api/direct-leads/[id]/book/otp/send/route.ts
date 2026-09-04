import { POST_directLeadBookOtpSend } from "@/lib/logged-handlers";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return POST_directLeadBookOtpSend(req as never, ctx);
}
