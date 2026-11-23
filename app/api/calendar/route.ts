function icsDate(date: Date) {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("date"); const start = value ? new Date(value) : null;
  if (!start || Number.isNaN(start.getTime())) return new Response("Invalid appointment date", { status: 422 });
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//รพ.สต. สระโคล่//TH", "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@care-back-ht`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, "SUMMARY:นัดคลินิกความดัน", "LOCATION:รพ.สต. สระโคล่", "DESCRIPTION:กรุณานำยาและสมุดประจำตัวมาด้วย", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": "attachment; filename=appointment.ics" } });
}
