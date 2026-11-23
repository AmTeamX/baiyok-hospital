import { expect, test, type Page, type Route } from "@playwright/test";

async function mockQueueApis(page: Page) {
  await page.route(/\/api\/patient\/me\/queue-slots$/, (route: Route) =>
    route.fulfill({
      json: {
        ok: true,
        slots: [
          { id: "s1", clinic: "คลินิกความดัน", serviceDate: "2026-12-01", startsAt: "2026-12-01T08:00:00+07:00", endsAt: "2026-12-01T09:00:00+07:00", capacity: 20, bookedCount: 5, remaining: 15 }
        ]
      }
    })
  );
  await page.route(/\/api\/patient\/me\/bookings$/, (route: Route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ json: { ok: true, bookingId: "b1", queueNumber: 6, checkInUrl: "/check-in?appointment=a1&token=t" } });
    }
    return route.fulfill({ json: { ok: true, bookings: [] } });
  });
}

test.use({ viewport: { width: 320, height: 568 } });

test("patient books a slot and receives a queue number + check-in link", async ({ page }) => {
  await mockQueueApis(page);
  await page.goto("/liff/queue");

  await expect(page.getByText("จองคิว", { exact: true })).toBeVisible();
  await page.getByRole("radio").click();
  await page.getByRole("button", { name: "ยืนยันการจอง" }).click();

  await expect(page.getByText("จองคิวสำเร็จ")).toBeVisible();
  await expect(page.getByText(/คิวที่ 6/)).toBeVisible();
  await expect(page.getByRole("link", { name: "เปิด QR เช็กอิน" })).toBeVisible();
});

test("patient sees an empty state when there are no bookable slots", async ({ page }) => {
  await page.route(/\/api\/patient\/me\/queue-slots$/, (route: Route) => route.fulfill({ json: { ok: true, slots: [] } }));
  await page.route(/\/api\/patient\/me\/bookings$/, (route: Route) => route.fulfill({ json: { ok: true, bookings: [] } }));

  await page.goto("/liff/queue");
  await expect(page.getByText("ยังไม่มีช่วงเวลาที่เปิดจอง")).toBeVisible();
});
