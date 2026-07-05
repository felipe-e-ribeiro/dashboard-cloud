import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

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
    expect(screen.getByText("USD 80.00")).toBeInTheDocument();
    expect(screen.getByText("80% do custo total do período")).toBeInTheDocument();
    expect(await screen.findByTestId("service-detail-chart")).toBeInTheDocument();
  });
});
