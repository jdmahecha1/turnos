import { describe, expect, it } from "vitest";

import { confirmDestination, isNoticeKey, NOTICES } from "./auth-notices";

describe("confirmDestination", () => {
  it("welcomes the user in the panel when the session opened", () => {
    expect(confirmDestination({ linkError: false, signedIn: true })).toBe("/panel?aviso=welcome");
  });

  it("says the email is verified and asks to sign in when opened in another browser", () => {
    expect(confirmDestination({ linkError: false, signedIn: false })).toBe("/login?aviso=verified");
    expect(NOTICES.verified.title).toMatch(/verificado/);
  });

  it("explains expired or reused links", () => {
    expect(confirmDestination({ linkError: true, signedIn: false })).toBe(
      "/login?aviso=link-expired",
    );
  });
});

describe("isNoticeKey", () => {
  it("only accepts known notices", () => {
    expect(isNoticeKey("verified")).toBe(true);
    expect(isNoticeKey("<script>")).toBe(false);
    expect(isNoticeKey(["verified"])).toBe(false);
    expect(isNoticeKey(undefined)).toBe(false);
  });
});
