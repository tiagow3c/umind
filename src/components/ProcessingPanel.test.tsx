import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { ProcessingPanel } from "./ProcessingPanel";
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/processing.functions", () => ({ advanceProcessing: () => new Promise(() => {}), retryProcessing: vi.fn() }));
vi.mock("@/lib/review", () => ({ ERROR_LABEL: {}, RUN_LABEL: {}, STAGE_LABEL: {} }));
vi.mock("@/lib/meetings", () => ({ cancelProcessing: vi.fn(), deleteMeeting: vi.fn() }));
afterEach(() => { vi.useRealTimers(); });
it("visibly advances before a slow first response, without pretending completion", async () => {
  vi.useFakeTimers();
  render(<QueryClientProvider client={new QueryClient()}><ProcessingPanel meetingId="test" status="processing" compact /></QueryClientProvider>);
  const progress = screen.getByRole("progressbar");
  expect(progress.getAttribute("aria-valuenow")).toBe("2");
  await act(async () => { vi.advanceTimersByTime(30000); });
  expect(Number(progress.getAttribute("aria-valuenow"))).toBeGreaterThan(2);
  expect(Number(progress.getAttribute("aria-valuenow"))).toBeLessThan(100);
});