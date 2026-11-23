import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const login = request.nextUrl.clone(); login.pathname = "/login"; login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "nurse"].includes(profile.role)) {
    const unauthorized = request.nextUrl.clone(); unauthorized.pathname = "/unauthorized"; unauthorized.search = "";
    return NextResponse.redirect(unauthorized);
  }
  return response;
}

export const config = {
  matcher: ["/", "/import/:path*", "/imports/:path*", "/missed/:path*", "/patients/:path*", "/follow-up/:path*", "/education/:path*", "/notifications/:path*", "/requests/:path*", "/admin/:path*", "/queue/:path*"]
};
