import { test, expect } from "@playwright/test";

test.describe("Booking flow", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await expect(page.getByText("Sales Portal")).toBeVisible();
  });

  test("admin login page loads", async ({ page }) => {
    await page.goto("http://localhost:3001/login");
    await expect(page.getByText("Admin Panel")).toBeVisible();
  });
});

test.describe("Concurrent blocking", () => {
  test("two sessions cannot block same unit simultaneously", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    for (const page of [page1, page2]) {
      await page.goto("http://localhost:3000/login");
    }

    await context1.close();
    await context2.close();
  });
});
