import { describe, expect, it } from "vitest";
import { toggleVote } from "./vote-selector";

describe("toggleVote", () => {
  it("cycles through all answers when yes votes are allowed", () => {
    expect(toggleVote("no")).toBe("yes");
  });

  it("skips yes when the option has reached its limit", () => {
    expect(toggleVote(undefined, true, false)).toBe("ifNeedBe");
    expect(toggleVote("no", true, false)).toBe("ifNeedBe");
    expect(toggleVote("no", false, false)).toBe("no");
  });
});
