import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Landing page of the sign-up confirmation email. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("missing token") };

  const target = request.nextUrl.clone();
  target.search = "";
  target.pathname = error ? "/login" : "/panel";
  return NextResponse.redirect(target);
}
