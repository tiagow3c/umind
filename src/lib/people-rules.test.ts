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
