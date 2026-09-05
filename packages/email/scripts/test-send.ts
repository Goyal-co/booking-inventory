import { blockNotificationEmail, getEmailConfigStatus, getEmailBaseUrl, sendEmail } from "../src/index";

async function main() {
  console.log("config", getEmailConfigStatus());
  const base = getEmailBaseUrl();
  const { subject, html } = blockNotificationEmail({
    customerName: "Test Customer",
    projectName: "Orchid Life",
    unitNumber: "A-004",
    towerName: "Tower A",
    bookingUrl: `${base}/booking/test-token`,
    dashboardUrl: `${base}/dashboard?token=test-token`,
    hasCostSheetAttachment: false,
  });
  const to = process.argv[2] || "22695A0528@mits.ac.in";
  console.log("email links use base:", base);
  const result = await sendEmail({ to, subject, html });
  console.log("result", result);
  if (!result.success) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
