import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    // Collect cookies set during the code exchange
    const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.headers
              .get("cookie")
              ?.split("; ")
              .map((c) => {
                const [name, ...rest] = c.split("=");
                return { name, value: rest.join("=") };
              }) ?? [];
          },
          setAll(cookies) {
            cookiesToSet.push(...cookies);
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      let redirectTo = "/onboarding";

      // Check if user already has a profile (returning user vs. new signup)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.username) {
          redirectTo = "/feed";
        }
      }

      const response = NextResponse.redirect(`${origin}${redirectTo}`);
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    }
  }

  // If no code or code exchange fails, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
