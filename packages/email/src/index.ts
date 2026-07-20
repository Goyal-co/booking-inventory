import {
  wrapEmail,
  emailHeader,
  emailBody,
  projectCard,
  numberedSteps,
  primaryButton,
  secondaryButton,
  linkFallback,
  emailSupportBlock,
  emailStatsBlock,
  emailFooter,
  GOLD,
  NAVY,
  MUTED,
} from "./layout";

export interface EmailAttachment {
  name: string;
  content: string; // base64
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  success: boolean;
  id?: string;
  error?: string;
  mocked?: boolean;
}

function getBrevoApiKey(): string | undefined {
  return process.env.BREVO_API_KEY?.trim();
}

function optionsFromEnv(): string {
  return process.env.EMAIL_FROM?.trim() || "noreply@goyalprojects.com";
}

function getSender(): { name: string; email: string } {
  const from = optionsFromEnv();
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "Goyal & Co. | Hariyana Group";
  const bracketMatch = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (bracketMatch) {
    return { name: bracketMatch[1].trim(), email: bracketMatch[2].trim() };
  }
  return { name: fromName, email: from };
}

export function shouldUseMockEmail(): boolean {
  const apiKey = getBrevoApiKey();
  if (!apiKey) return true;
  return /placeholder|your_|example|^xkeysib-dev_/i.test(apiKey);
}

export async function sendEmail(options: EmailOptions): Promise<EmailSendResult> {
  const sender = getSender();
  const fromOverride = options.from?.trim();
  const resolvedSender = fromOverride
    ? (() => {
        const match = fromOverride.match(/^(.+?)\s*<([^>]+)>$/);
        return match
          ? { name: match[1].trim(), email: match[2].trim() }
          : { name: sender.name, email: fromOverride };
      })()
    : sender;

  if (shouldUseMockEmail()) {
    if (process.env.NODE_ENV === "production") {
      return { success: false, error: "BREVO_API_KEY required in production" };
    }
    console.warn(
      "[Email] MOCK MODE — BREVO_API_KEY not loaded. Restart the server after updating .env.local"
    );
    console.log("[Email Mock] From:", `${resolvedSender.name} <${resolvedSender.email}>`);
    console.log("[Email Mock] To:", options.to);
    console.log("[Email Mock] Subject:", options.subject);
    if (options.attachments?.length) {
      console.log(
        "[Email Mock] Attachments:",
        options.attachments.map((a) => a.name).join(", ")
      );
    }
    return { success: true, id: `mock-${Date.now()}`, mocked: true };
  }

  const apiKey = getBrevoApiKey()!;
  console.log("[Email] Sending via Brevo to:", options.to);
  try {
    const payload: Record<string, unknown> = {
      sender: {
        name: resolvedSender.name,
        email: resolvedSender.email,
      },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    };
    if (options.attachments?.length) {
      payload.attachment = options.attachments.map((a) => ({
        name: a.name,
        content: a.content,
      }));
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Brevo API error:", err);
      return { success: false, error: err };
    }

    const data = (await res.json()) as { messageId?: string };
    console.log("[Email] Brevo sent:", data.messageId);
    return { success: true, id: data.messageId };
  } catch (error) {
    console.error("[Email] Brevo request failed:", error);
    return { success: false, error: String(error) };
  }
}

/** EOI-style branded email inviting the customer to complete the digital booking form */
export function blockNotificationEmail(params: {
  customerName: string;
  projectName: string;
  unitNumber: string;
  towerName: string;
  bookingUrl: string;
  dashboardUrl?: string;
  brochureUrl?: string;
  hasCostSheetAttachment?: boolean;
}) {
  const brochureBlock = params.brochureUrl
    ? `<p style="margin:8px 0 0;text-align:center;"><a href="${params.brochureUrl}" style="color:#2563EB;text-decoration:none;font-size:14px;">Download Project Brochure</a></p>`
    : "";
  const costSheetNote = params.hasCostSheetAttachment
    ? `<p style="margin:12px 0 0;font-size:13px;color:${MUTED};text-align:center;">Your unit cost sheet is attached to this email (open and use Print → Save as PDF if needed).</p>`
    : "";

  const html = wrapEmail([
    emailHeader("Digital Booking Form &nbsp;|&nbsp; Action Required"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong style="color:${GOLD};">${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">
        Your unit has been reserved. Please complete your digital booking form for:
      </p>
      ${projectCard({
        projectName: params.projectName,
        towerName: params.towerName,
        unitNumber: params.unitNumber,
      })}
      <p style="margin:0 0 8px;color:${MUTED};">
        Use the secure link below to fill the form, verify your email OTP, and upload your documents (PAN, Aadhaar, and payment proof).
      </p>
      ${numberedSteps([
        "Open your booking form link.",
        "Review the attached cost sheet for your unit.",
        "Complete each section, verify OTP, upload KYC + payment proof, and submit.",
      ])}
      <div style="text-align:center;">${primaryButton("Open Booking Form", params.bookingUrl)}</div>
      ${
        params.dashboardUrl
          ? `<div style="text-align:center;">${secondaryButton("Open Customer Dashboard", params.dashboardUrl)}</div>`
          : ""
      }
      ${costSheetNote}
      ${brochureBlock}
      ${linkFallback(params.bookingUrl, "Booking form link")}
      ${params.dashboardUrl ? linkFallback(params.dashboardUrl, "Customer dashboard link") : ""}
      <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">
        If the link has expired, contact your sales representative and ask them to resend a fresh booking link.
      </p>
    `),
    emailSupportBlock(),
    emailStatsBlock(),
    emailFooter(),
  ]);

  return {
    subject: `Complete your booking form — ${params.projectName}`,
    html,
  };
}

export function otpVerificationEmail(params: { otp: string; projectName?: string }) {
  const html = wrapEmail([
    emailHeader("Identity Verification"),
    emailBody(`
      <p style="margin:0 0 12px;color:${MUTED};">Use this one-time code to verify your identity on the booking form.</p>
      <p style="margin:24px 0;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:${NAVY};">${params.otp}</p>
      <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">This code expires shortly. Do not share it with anyone.</p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);

  return {
    subject: params.projectName
      ? `Your verification code — ${params.projectName}`
      : "Your booking form verification code",
    html,
  };
}
