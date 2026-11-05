import { describe, expect, it } from "vitest";
import { parseShareSummary, threadComments } from "./share-rules";

describe("share rules", () => {
  it("parses JSON wrapped in extra text", () => {
    const s = parseShareSummary('ok {"intro":"Oi","happened":"","topics":[{"title":"A","explanation":"b"}],"decisions":["x"],"next_steps":[]}');
    expect(s?.intro).toBe("Oi");
    expect(s?.topics).toHaveLength(1);
  });
  it("rejects empty summaries", () => {
    expect(parseShareSummary('{"intro":"","happened":""}')).toBeNull();
  });
  it("nests replies under their thread", () => {
    const t = threadComments([
      { id: "1", parent_id: null, created_at: "1" },
      { id: "2", parent_id: "1", created_at: "2" },
    ]);
    expect(t).toHaveLength(1);
    expect(t[0].replies.map((r) => r.id)).toEqual(["2"]);
  });
});
