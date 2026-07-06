import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { providerStatusesResponse } from "./providerStatusFixture";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Service drill-down", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a placeholder until a service is selected, then fetches its monthly trend", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/settings/providers")) {
        return Promise.resolve(jsonResponse(providerStatusesResponse()));
      }
      if (url.includes("/api/costs/summary")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            total: 100,
            previous_total: 100,
            change_pct: 0,
            trend: [],
          }),
        );
      }
      if (url.includes("/api/costs/breakdown")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            items: [{ service_name: "EC2", amount: 80 }],
          }),
        );
      }
      if (url.includes("/api/costs/service-trend")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            service_name: "EC2",
            currency: "USD",
            points: [
              { month: "2026-05", amount: 40 },
              { month: "2026-06", amount: 60 },
              { month: "2026-07", amount: 80 },
            ],
          }),
        );
      }
      if (url.includes("/api/sync/status")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", status: null, started_at: null, finished_at: null, error_message: null }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "AWS" }));

    expect(await screen.findByText("Selecione um serviço para ver o detalhe.")).toBeInTheDocument();

    await user.click(await screen.findByRole("row", { name: /EC2/ }));

    expect(await screen.findByText("EC2", { selector: ".service-detail-name" })).toBeInTheDocument();
    expect(screen.getByText("$80.00", { selector: ".service-detail-total" })).toBeInTheDocument();
    expect(screen.getByText("80% do custo total do período")).toBeInTheDocument();
    expect(await screen.findByTestId("service-detail-chart")).toBeInTheDocument();
  });

  it("compares daily averages so a partial current month isn't misread as a cost decrease", async () => {
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const daysElapsed = today.getDate();
    const daysInLastMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();

    // Last month: a flat daily rate of $20/day for the whole month. Current month so far:
    // a higher daily rate of ~$23.33/day, but its raw total is still lower than last month's
    // full-month total (since only `daysElapsed` days have accumulated). The raw totals look
    // like a decrease; the daily rate is actually higher.
    const lastMonthTotal = daysInLastMonth * 20;
    const currentMonthTotal = daysElapsed * 23.33;

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/settings/providers")) {
        return Promise.resolve(jsonResponse(providerStatusesResponse()));
      }
      if (url.includes("/api/costs/summary")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            total: currentMonthTotal,
            previous_total: currentMonthTotal,
            change_pct: 0,
            trend: [],
          }),
        );
      }
      if (url.includes("/api/costs/breakdown")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            items: [{ service_name: "EC2", amount: currentMonthTotal }],
          }),
        );
      }
      if (url.includes("/api/costs/service-trend")) {
        // Last month: a full month at $20/day. Current month so far: a higher ~$23.33/day
        // rate, but its raw total (fewer days elapsed) is still lower than last month's
        // full-month total. Raw totals look like a decrease; the daily rate is actually up.
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            service_name: "EC2",
            currency: "USD",
            points: [
              { month: lastMonthKey, amount: lastMonthTotal },
              { month: currentMonthKey, amount: currentMonthTotal },
            ],
          }),
        );
      }
      if (url.includes("/api/sync/status")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", status: null, started_at: null, finished_at: null, error_message: null }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "AWS" }));
    await user.click(await screen.findByRole("row", { name: /EC2/ }));

    const badge = await screen.findByText(/vs\. média diária do mês anterior/);
    expect(badge).toHaveClass("change-up");
    expect(screen.getByText(/O mês atual ainda está em andamento/)).toBeInTheDocument();
  });
});
