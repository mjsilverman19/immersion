import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");

  // Check auth routes first to avoid prefix collisions (e.g. /login matches /log)
  if (isAuthRoute) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/feed";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const isMainRoute =
    request.nextUrl.pathname.startsWith("/feed") ||
    request.nextUrl.pathname.startsWith("/explore") ||
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/city") ||
    request.nextUrl.pathname.startsWith("/place") ||
    request.nextUrl.pathname.startsWith("/list") ||
    request.nextUrl.pathname.startsWith("/lists") ||
    request.nextUrl.pathname.startsWith("/import") ||
    request.nextUrl.pathname.startsWith("/map") ||
    request.nextUrl.pathname.startsWith("/log") ||
    request.nextUrl.pathname.startsWith("/saved") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  if (!user && isMainRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
