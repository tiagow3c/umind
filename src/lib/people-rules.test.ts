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
  it("instagram sem foto baixada", () => expect(avatarSrc({ instagram: "a" })).toBeNull());
  it("nada", () => expect(avatarSrc({})).toBeNull());
});

import { suggestCandidates } from "./people-rules";
describe("suggestCandidates", () => {
  const people = [
    { id: "a", display_name: "Carlos Mendes", aliases: [], meetings: [{ id: "1" }] },
    { id: "b", display_name: "Ana", aliases: [], meetings: [{ id: "1" }, { id: "2" }, { id: "3" }] },
    { id: "c", display_name: "Bruno", aliases: [], meetings: [] },
  ];
  it("puts people cited in the transcript first, with mention time", () => {
    const r = suggestCandidates([{ text: "Oi, Carlos, tudo bem?", start_ms: 80000 }], people, new Set());
    expect(r[0]).toEqual({ person: people[0], mentionMs: 80000 });
    expect(r[1]!.person.id).toBe("b");
  });
  it("excludes people already assigned", () => {
    const r = suggestCandidates([], people, new Set(["b"]));
    expect(r.map((x) => x.person.id)).toEqual(["a", "c"]);
  });
});

describe("inferSpeakersFromConversation", () => {
  const people = [{ id: "c", display_name: "Carlos Mendes", aliases: [] }, { id: "t", display_name: "Tiago Vicente", aliases: [] }];
  const owner = new Map([[0, "t"]]);
  it("links the voice that answers after the name is said twice", () => {
    const turns = [
      { speaker: 0, text: "Oi Carlos, tudo bem?" }, { speaker: 1, text: "Tudo ótimo" },
      { speaker: 0, text: "E o prazo, Carlos?" }, { speaker: 1, text: "Fica para sexta" },
    ];
    expect(inferSpeakersFromConversation(turns, people, owner).get(1)).toBe("c");
  });
  it("does not link from a single mention", () => {
    const turns = [{ speaker: 0, text: "Oi Carlos" }, { speaker: 1, text: "Oi" }];
    expect(inferSpeakersFromConversation(turns, people, owner).size).toBe(0);
  });
  it("self-introduction links the speaker", () => {
    expect(inferSpeakersFromConversation([{ speaker: 1, text: "Bom dia, aqui é o Carlos" }], people, owner).get(1)).toBe("c");
  });
  it("never reassigns the owner", () => {
    const turns = [{ speaker: 1, text: "Tiago, e aí?" }, { speaker: 0, text: "Oi" }, { speaker: 1, text: "Tiago?" }, { speaker: 0, text: "Sim" }];
    expect(inferSpeakersFromConversation(turns, people, owner).has(0)).toBe(false);
  });
});
