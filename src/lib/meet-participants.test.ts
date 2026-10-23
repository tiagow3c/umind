import { describe, it, expect } from "vitest";
import { isMeetPhotoUrl, isMeetPersonName } from "./people-rules";

describe("Meet participants", () => {
  it("only downloads Google avatar URLs", () => {
    expect(isMeetPhotoUrl("https://lh3.googleusercontent.com/a/abc=s192")).toBe(true);
    expect(isMeetPhotoUrl("https://evil.com/x.jpg")).toBe(false);
    expect(isMeetPhotoUrl("http://lh3.googleusercontent.com/a")).toBe(false);
  });
  it("ignores self and presentation tiles", () => {
    expect(isMeetPersonName("Taylor Teixeira")).toBe(true);
    expect(isMeetPersonName("Você")).toBe(false);
    expect(isMeetPersonName("Rodrigo (Apresentação)")).toBe(false);
  });
});

import { isStrayVoice } from "./people-rules";
describe("stray voices", () => {
  it("hides a 9.7 s unnamed voice in a 30 min meeting", () => expect(isStrayVoice(9700, 1_800_000, false)).toBe(true));
  it("keeps it once someone names it", () => expect(isStrayVoice(9700, 1_800_000, true)).toBe(false));
  it("keeps short voices in short meetings", () => expect(isStrayVoice(9700, 120_000, false)).toBe(false));
});
