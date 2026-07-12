const GOLD = "#C9A84C";
const NAVY = "#1A2332";
const MUTED = "#64748B";
const LIGHT_BG = "#F8F9FB";
const BORDER = "#E8ECF1";

export function getEmailBaseUrl(): string {
  const fromCustomer =
    process.env.CUSTOMER_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CUSTOMER_URL?.replace(/\/$/, "") ||
    "";
  if (fromCustomer) return fromCustomer;
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.SALES_URL?.replace(/\/$/, "") ||
    "http://localhost:3003"
  );
}

export function getEmailLogoUrl(): string {
  return (
    process.env.EMAIL_LOGO_URL?.trim() ||
    `${getEmailBaseUrl()}/logo.svg`
  );
}

export function emailShell(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Goyal & Co. | Hariyana Group</title>
</head>
<body style="margin:0;padding:0;background:#ECEFF3;font-family:'Segoe UI',Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEFF3;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(26,35,50,0.08);">
          ${body}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailHeader(stepLabel?: string): string {
  const logoUrl = getEmailLogoUrl();
  const stepBlock = stepLabel
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:999px;background:#ffffff;">
              <tr>
                <td style="padding:10px 18px;font-size:11px;font-weight:700;letter-spacing:0.08em;color:${NAVY};text-transform:uppercase;">
                  ${stepLabel}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  return `
    <tr>
      <td style="padding:32px 32px 24px;text-align:center;background:#ffffff;">
        <img src="${logoUrl}" alt="Goyal & Co. | Hariyana Group" width="280" style="max-width:280px;width:100%;height:auto;display:block;margin:0 auto;" />
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
          <tr>
            <td width="30%" style="border-bottom:1px solid ${GOLD};">&nbsp;</td>
            <td style="padding:0 12px;font-size:11px;color:${MUTED};white-space:nowrap;font-style:italic;">creating landmarks since 1971</td>
            <td width="30%" style="border-bottom:1px solid ${GOLD};">&nbsp;</td>
          </tr>
        </table>
        ${stepBlock}
      </td>
    </tr>`;
}

export function emailBody(content: string): string {
  return `
    <tr>
      <td style="padding:24px 32px 8px;color:${NAVY};font-size:15px;line-height:1.7;">
        ${content}
      </td>
    </tr>`;
}

export function projectCard(params: {
  projectName: string;
  towerName: string;
  unitNumber: string;
}): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:${LIGHT_BG};border:1px solid ${BORDER};border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:14px;font-size:28px;color:${GOLD};">&#127970;</td>
              <td>
                <p style="margin:0;font-size:20px;font-weight:700;color:${NAVY};">${params.projectName}</p>
                <p style="margin:6px 0 0;font-size:14px;color:${MUTED};">${params.towerName} · Unit ${params.unitNumber}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function numberedSteps(steps: string[]): string {
  const rows = steps
    .map(
      (step, i) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:28px;vertical-align:top;">
              <div style="width:24px;height:24px;border-radius:50%;border:2px solid ${GOLD};color:${GOLD};font-size:12px;font-weight:700;line-height:20px;text-align:center;">${i + 1}</div>
            </td>
            <td style="padding-left:12px;font-size:14px;line-height:1.6;color:${MUTED};">${step}</td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows}
    </table>`;
}

export function primaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
      <tr>
        <td align="center" style="border-radius:8px;background:${GOLD};">
          <a href="${href}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${label} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

export function secondaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 24px;">
      <tr>
        <td align="center" style="border-radius:8px;border:2px solid ${NAVY};">
          <a href="${href}" style="display:inline-block;padding:12px 28px;color:${NAVY};text-decoration:none;font-size:15px;font-weight:600;">${label} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

export function linkFallback(url: string, label: string): string {
  return `
    <p style="margin:16px 0 4px;font-size:12px;color:${MUTED};">${label}:</p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;">
      <a href="${url}" style="color:#2563EB;">${url}</a>
    </p>`;
}

export function emailSupportBlock(): string {
  return `
    <tr>
      <td style="padding:8px 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border:1px solid ${BORDER};border-radius:12px;">
          <tr>
            <td style="padding:20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" style="vertical-align:top;">
                    <div style="width:36px;height:36px;border-radius:50%;background:rgba(201,168,76,0.15);text-align:center;line-height:36px;font-size:18px;color:${GOLD};">&#128222;</div>
                  </td>
                  <td>
                    <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${NAVY};">Need Assistance?</p>
                    <p style="margin:0 0 12px;font-size:13px;color:${MUTED};">Our relationship team is here to help you.</p>
                    <p style="margin:0 0 6px;font-size:13px;color:${NAVY};">&#128222; +91 80888 66000 &nbsp;|&nbsp; +91 80888 33000</p>
                    <p style="margin:0;font-size:13px;"><a href="mailto:info.bng@goyalco.com" style="color:${NAVY};text-decoration:none;">&#9993; info.bng@goyalco.com</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function emailStatsBlock(): string {
  const stats = [
    { value: "55+", label: "Years of Legacy" },
    { value: "250+", label: "Projects Delivered" },
    { value: "35+", label: "Million Sqft. under Development" },
  ];

  const cols = stats
    .map(
      (s, i) => `
    <td width="33%" style="padding:16px 8px;text-align:center;${i > 0 ? `border-left:1px solid ${BORDER};` : ""}">
      <p style="margin:0;font-size:22px;font-weight:700;color:${GOLD};">${s.value}</p>
      <p style="margin:6px 0 0;font-size:11px;color:${MUTED};line-height:1.4;">${s.label}</p>
    </td>`
    )
    .join("");

  return `
    <tr>
      <td style="padding:0 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border:1px solid ${BORDER};border-radius:12px;">
          <tr>${cols}</tr>
        </table>
      </td>
    </tr>`;
}

export function emailFooter(): string {
  return `
    <tr>
      <td style="padding:0 32px 32px;text-align:center;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};padding-top:20px;">
          <tr>
            <td style="text-align:center;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${NAVY};">Goyal & Co. | Hariyana Group</p>
              <p style="margin:0 0 16px;font-size:12px;color:${MUTED};">Building Trust. Creating Landmarks.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function wrapEmail(parts: string[]): string {
  return emailShell(parts.join(""));
}

export { GOLD, NAVY, MUTED };
