import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createUserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy refreshes sessions. */ }
      }
    }
  });
}

export async function requireClinicalStaff() {
  const supabase = await createUserClient();
  if (!supabase) return { mode: "demo" as const, userId: null, serviceUnitId: null, role: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, service_unit_id").eq("id", user.id).single();
  if (!profile || !["admin", "nurse"].includes(profile.role)) return null;
  return { mode: "authenticated" as const, userId: user.id, serviceUnitId: profile.service_unit_id ?? null, role: profile.role as "admin" | "nurse" };
}
