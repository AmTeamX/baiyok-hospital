import { expect, test, type Page, type Route } from "@playwright/test";

const appointmentAt = "2026-12-01T08:30:00+07:00";

function mockPatientApis(page: Page) {
  return page.route(/\/api\/patient\/me\/appointments$/, (route: Route) =>
    route.fulfill({
      json: {
        ok: true,
        appointments: [{ id: "a1", appointmentAt, clinic: "คลินิกความดัน", status: "scheduled" }]
      }
    })
  );
}

test.use({ viewport: { width: 320, height: 568 } });

test("patient sees their next appointment with a calendar link", async ({ page }) => {
  await mockPatientApis(page);
  await page.goto("/liff/appointments");

  await expect(page.getByText("วันนัดของฉัน")).toBeVisible();
  await expect(page.getByText("คลินิกความดัน รพ.สต. สระโคล่")).toBeVisible();
  await expect(page.getByRole("link", { name: "เพิ่มเตือนในปฏิทิน" })).toBeVisible();
});

test("patient sees an empty state without appointments", async ({ page }) => {
  await page.route(/\/api\/patient\/me\/appointments$/, (route: Route) =>
    route.fulfill({ json: { ok: true, appointments: [] } })
  );
  await page.goto("/liff/appointments");
  await expect(page.getByText("ยังไม่มีนัดถัดไป")).toBeVisible();
});

test("patient sees a past missed appointment and can report a problem", async ({ page }) => {
  await page.route(/\/api\/patient\/me\/appointments$/, (route: Route) =>
    route.fulfill({
      json: {
        ok: true,
        appointments: [],
        history: [{ id: "a2", appointmentAt: "2026-10-01T08:30:00+07:00", clinic: "คลินิกเบาหวาน", status: "missed" }]
      }
    })
  );
  await page.goto("/liff/appointments");

  await expect(page.getByText("นัดที่ผ่านมา")).toBeVisible();
  await expect(page.getByText("ขาดนัด")).toBeVisible();
  await expect(page.getByRole("link", { name: "แจ้งปัญหาเรื่องนัดนี้" })).toHaveAttribute("href", "/liff/problem?appointmentId=a2");
});

test("patient answers a health question and sees immediate feedback", async ({ page }) => {
  await page.route(/\/api\/patient\/me\/health-content$/, (route: Route) =>
    route.fulfill({
      json: {
        ok: true,
        contents: [
          {
            id: "c1",
            slug: "no-symptoms",
            title: "ไม่มีอาการ ไม่ได้แปลว่าหาย",
            body: "ความดันสูงมักไม่แสดงอาการ",
            imageUrl: null,
            imageAlt: null,
            version: 1,
            questions: [
              {
                id: "q1",
                prompt: "ถ้าวันนี้รู้สึกปกติ ยังต้องกินยาไหม?",
                options: [
                  { value: "a", label: "ต้องกินยาและมาตามนัด", correct: true, feedback: "ถูกต้องแล้ว" },
                  { value: "b", label: "ไม่ต้องกินยา", correct: false, feedback: "ลองทบทวนอีกครั้ง" }
                ]
              }
            ]
          }
        ]
      }
    })
  );
  await page.route(/\/api\/patient\/me\/health-answers$/, (route: Route) =>
    route.fulfill({ json: { ok: true } })
  );

  await page.goto("/liff/education");
  await expect(page.getByText("ไม่มีอาการ ไม่ได้แปลว่าหาย")).toBeVisible();

  await page.getByText("ต้องกินยาและมาตามนัด").click();
  await expect(page.getByText("ถูกต้องแล้ว")).toBeVisible();
});

test("patient submits a problem and receives acknowledgement", async ({ page }) => {
  await page.route(/\/api\/patient\/me\/requests$/, (route: Route) =>
    route.fulfill({ json: { ok: true, id: "r1", status: "new" } })
  );

  await page.goto("/liff/problem");
  await page.getByText("เดินทางไม่สะดวก").click();
  await page.getByRole("button", { name: "ส่งเรื่องให้เจ้าหน้าที่" }).click();

  await expect(page.getByText("รับเรื่องแล้ว")).toBeVisible();
});
