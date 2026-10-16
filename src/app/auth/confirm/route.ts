import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { confirmDestination } from "@/lib/auth-notices";
import { createClient } from "@/lib/supabase/server";

/** Landing page of the sign-up confirmation email. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let signedIn = false;
  const linkError = searchParams.has("error") || searchParams.has("error_code");

  if (!linkError) {
    const supabase = await createClient();
    if (code) {
      signedIn = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && type) {
      signedIn = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    }
  }

  const noCredentials = !code && !(tokenHash && type);
  const target = new URL(
    confirmDestination({ linkError: linkError || (noCredentials && !signedIn), signedIn }),
    request.nextUrl.origin,
  );
  return NextResponse.redirect(target);
}
