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
