import { describe, expect, it } from "vitest";
import { addDays, dayForTask, dayRange, displayDay, groupByDay } from "./todo-rules";

describe("agenda por dia", () => {
  it("item não feito de ontem aparece hoje", () => expect(displayDay({ day: "2026-10-19", done_at: null }, "2026-10-20")).toBe("2026-10-20"));
  it("item feito fica no seu dia", () => expect(displayDay({ day: "2026-10-19", done_at: "x" }, "2026-10-20")).toBe("2026-10-19"));
  it("item futuro fica no seu dia", () => expect(displayDay({ day: "2026-10-22", done_at: null }, "2026-10-20")).toBe("2026-10-22"));
  it("tarefa com prazo futuro vai para o dia do prazo", () => expect(dayForTask("2026-10-25", "2026-10-20")).toBe("2026-10-25"));
  it("tarefa sem prazo ou atrasada vai para hoje", () => {
    expect(dayForTask(null, "2026-10-20")).toBe("2026-10-20");
    expect(dayForTask("2026-10-01", "2026-10-20")).toBe("2026-10-20");
  });
  it("dias atravessam o fim do mês", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(dayRange("2026-10-30", 3)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
  it("feitos ficam no fim da coluna", () => {
    const g = groupByDay([{ id: "a", day: "2026-10-20", done_at: "x", position: 0 }, { id: "b", day: "2026-10-20", done_at: null, position: 5 }], ["2026-10-20"], "2026-10-20");
    expect(g.get("2026-10-20")!.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
