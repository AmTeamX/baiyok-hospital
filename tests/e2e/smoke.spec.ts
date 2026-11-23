import { expect, test } from "@playwright/test";

test("login page renders the service name", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("รพ.สต. สระโคล่")).toBeVisible();
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeVisible();
});
