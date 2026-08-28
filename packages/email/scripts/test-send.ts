import { blockNotificationEmail, getEmailConfigStatus, sendEmail } from "../src/index";

async function main() {
  console.log("config", getEmailConfigStatus());
  const { subject, html } = blockNotificationEmail({
    customerName: "Test Customer",
    projectName: "Orchid Life",
    unitNumber: "A-004",
    towerName: "Tower A",
    bookingUrl: "http://localhost:3003/booking/test-token",
    dashboardUrl: "http://localhost:3003/dashboard?token=test-token",
    hasCostSheetAttachment: false,
  });
  const to = process.argv[2] || "22695A0528@mits.ac.in";
  const result = await sendEmail({ to, subject, html });
  console.log("result", result);
  if (!result.success) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
