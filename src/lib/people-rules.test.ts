import { describe, expect, it } from "vitest";
import { matchPerson } from "./people-rules";

const people = [
  { id: "1", display_name: "João Silva", aliases: [] },
  { id: "2", display_name: "Maria", aliases: ["Mari"] },
  { id: "3", display_name: "Ana Souza", aliases: [] },
  { id: "4", display_name: "Ana Lima", aliases: [] },
];

describe("matchPerson", () => {
  it("matches ignoring accents and case", () => expect(matchPerson("joao silva", people)?.id).toBe("1"));
  it("matches an alias", () => expect(matchPerson("Mari", people)?.id).toBe("2"));
  it("matches a unique first name", () => expect(matchPerson("João", people)?.id).toBe("1"));
  it("does not guess when first name is ambiguous", () => expect(matchPerson("Ana", people)).toBeNull());
  it("returns null for unknown names", () => expect(matchPerson("Pedro", people)).toBeNull());
});

import { parseNameHandle, avatarSrc } from "./people-rules";
describe("parseNameHandle", () => {
  it("separa nome e @", () => expect(parseNameHandle("João Silva @joao.silva")).toEqual({ name: "João Silva", instagram: "joao.silva" }));
  it("só @ vira nome também", () => expect(parseNameHandle("@Maria_x")).toEqual({ name: "maria_x", instagram: "maria_x" }));
  it("sem @ não tem instagram", () => expect(parseNameHandle("Ana")).toEqual({ name: "Ana", instagram: null }));
});
describe("avatarSrc", () => {
  it("foto vence instagram", () => expect(avatarSrc({ photo_url: "x", instagram: "a" })).toBe("x"));
  it("instagram sem foto", () => expect(avatarSrc({ instagram: "a" })).toContain("/instagram/a"));
  it("nada", () => expect(avatarSrc({})).toBeNull());
});
