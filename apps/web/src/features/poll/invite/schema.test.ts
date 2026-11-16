import { describe, expect, it } from "vitest";
import { inviteEmailsSchema, MAX_INVITES_PER_SUBMIT } from "./schema";

describe("inviteEmailsSchema", () => {
  it("splits on commas, semicolons and spaces, lowercases and dedupes", () => {
    expect(
      inviteEmailsSchema.parse("A@x.com, b@x.com;a@X.com  c@x.com"),
    ).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("rejects an empty value and an invalid address", () => {
    expect(inviteEmailsSchema.safeParse("  ").success).toBe(false);
    expect(inviteEmailsSchema.safeParse("a@x.com, nope").success).toBe(false);
  });

  it("rejects more addresses than the cap", () => {
    const many = Array.from(
      { length: MAX_INVITES_PER_SUBMIT + 1 },
      (_, i) => `u${i}@x.com`,
    ).join(",");
    expect(inviteEmailsSchema.safeParse(many).success).toBe(false);
  });
});
