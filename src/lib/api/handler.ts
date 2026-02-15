import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

interface AuthenticatedContext {
  user: { id: string; email?: string };
  supabase: ReturnType<typeof createClient>;
}

type HandlerWithBody<T> = (
  request: NextRequest,
  ctx: AuthenticatedContext,
  body: T
) => Promise<NextResponse>;

type HandlerWithoutBody = (
  request: NextRequest,
  ctx: AuthenticatedContext
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with auth check and optional zod validation.
 * Returns 401 if not authenticated, 400 with field errors if validation fails.
 */
export function authenticated<T>(
  schema: z.ZodType<T>,
  handler: HandlerWithBody<T>
): (request: NextRequest) => Promise<NextResponse>;
export function authenticated(
  schema: null,
  handler: HandlerWithoutBody
): (request: NextRequest) => Promise<NextResponse>;
export function authenticated<T>(
  schema: z.ZodType<T> | null,
  handler: HandlerWithBody<T> | HandlerWithoutBody
) {
  return async (request: NextRequest) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ctx: AuthenticatedContext = { user, supabase };

    if (!schema) {
      return (handler as HandlerWithoutBody)(request, ctx);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fields: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    return (handler as HandlerWithBody<T>)(request, ctx, result.data);
  };
}
