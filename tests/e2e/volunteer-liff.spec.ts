import { expect, test, type Page, type Route } from "@playwright/test";

const taskId = "11111111-1111-4111-8111-111111111111";

function thaiDateIso() {
  return new Date().toISOString();
}

const tasks = [
  {
    id: taskId,
    status: "assigned",
    priority: "urgent",
    assignedAt: thaiDateIso(),
    contactedAt: null,
    missedReason: "ลืมวันนัด",
    overdueSla: true,
    patient: { fullName: "นายสมชาย ทดสอบ", village: "สระโคล่", phone: "0811111111" },
    appointment: { appointmentAt: thaiDateIso(), clinic: "คลินิกความดัน" }
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    status: "contacted",
    priority: "normal",
    assignedAt: thaiDateIso(),
    contactedAt: thaiDateIso(),
    missedReason: null,
    overdueSla: false,
    patient: { fullName: "นางสมหญิง ทดสอบ", village: null, phone: null },
    appointment: { appointmentAt: thaiDateIso(), clinic: "คลินิกความดัน" }
  }
];

async function mockVolunteerApis(page: Page) {
  await page.route(/\/api\/volunteer\/me(\?.*)?$/, (route: Route) =>
    route.fulfill({ json: { ok: true, volunteer: { id: "vol-1", fullName: "อสม. มาลี" } } })
  );
  await page.route(/\/api\/volunteer\/tasks(\?.*)?$/, (route: Route) =>
    route.fulfill({ json: { ok: true, tasks } })
  );
  await page.route(new RegExp(`/api/volunteer/tasks/${taskId}$`), (route: Route) =>
    route.fulfill({ json: { ok: true, task: { ...tasks[0], version: 1 } } })
  );
  await page.route(new RegExp(`/api/volunteer/tasks/${taskId}/result$`), (route: Route) =>
    route.fulfill({ json: { ok: true, version: 2, status: "contacted", priority: "urgent" } })
  );
  await page.route(new RegExp(`/api/volunteer/tasks/${taskId}/escalate$`), (route: Route) =>
    route.fulfill({ json: { ok: true, version: 2, priority: "urgent" } })
  );
}

test.use({ viewport: { width: 320, height: 568 } });

test("volunteer completes a task flow on a 320px screen", async ({ page }) => {
  await mockVolunteerApis(page);
  await page.goto("/liff/volunteer");

  await expect(page.getByText("งานของฉัน")).toBeVisible();
  await expect(page.getByText("อสม. มาลี")).toBeVisible();
  await expect(page.getByRole("button", { name: "ใหม่" })).toBeVisible();

  await expect(page.getByText("นายสมชาย ทดสอบ")).toBeVisible();
  await expect(page.getByText("เกินกำหนด")).toBeVisible();

  await page.getByText("นายสมชาย ทดสอบ").click();
  await expect(page.getByText("บันทึกผลติดตาม")).toBeVisible();
  await expect(page.getByText("คลินิกความดัน")).toBeVisible();
  await expect(page.getByText("โทรหาผู้ป่วย")).toBeVisible();

  await page.getByLabel("ติดต่อได้และยืนยันว่าจะมา").click();
  await page.getByRole("button", { name: "บันทึกผล" }).click();
  await page.getByRole("button", { name: "ยืนยันบันทึก" }).click();

  await expect(page.getByText("บันทึกผลสำเร็จ")).toBeVisible();
});

test("volunteer task list shows empty state when there are no tasks", async ({ page }) => {
  await page.route(/\/api\/volunteer\/me(\?.*)?$/, (route: Route) =>
    route.fulfill({ json: { ok: true, volunteer: { id: "vol-1", fullName: "อสม. มาลี" } } })
  );
  await page.route(/\/api\/volunteer\/tasks(\?.*)?$/, (route: Route) =>
    route.fulfill({ json: { ok: true, tasks: [] } })
  );

  await page.goto("/liff/volunteer");
  await expect(page.getByText("ยังไม่มีงานในหมวดนี้")).toBeVisible();
});
