import { describe, expect, it } from "vitest";
import { canDemoteOrRemove, isAdminRole, normalizeInviteEmail, pickActiveWorkspace } from "./workspace-rules";

describe("workspace rules", () => {
  it("membro não pode convidar; admin e dono podem", () => {
    expect(isAdminRole("member")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("owner")).toBe(true);
  });
  it("o último dono não pode sair nem ser rebaixado", () => {
    expect(canDemoteOrRemove("owner", 1)).toBe(false);
    expect(canDemoteOrRemove("owner", 2)).toBe(true);
    expect(canDemoteOrRemove("member", 1)).toBe(true);
  });
  it("workspace salvo vale só se o usuário ainda participa", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(pickActiveWorkspace(list, "b")?.id).toBe("b");
    expect(pickActiveWorkspace(list, "x")?.id).toBe("a");
  });
  it("normaliza e-mail do convite", () => {
    expect(normalizeInviteEmail("  Ana@Empresa.com ")).toBe("ana@empresa.com");
    expect(normalizeInviteEmail("ana")).toBeNull();
  });
});
