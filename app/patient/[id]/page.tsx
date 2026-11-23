import { redirect } from "next/navigation";

// Legacy hard-coded patient page. The real patient view now lives behind LIFF
// identity (`/liff/appointments`) and never takes a patient id from the URL.
export default function PatientLegacyPage() {
  redirect("/liff/appointments");
}
