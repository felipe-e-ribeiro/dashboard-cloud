import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Overview tab", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the combined total and a card per provider", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/costs/summary")) {
        const provider = url.includes("provider=oci") ? "oci" : "aws";
        const total = provider === "aws" ? 100 : 20;
        return Promise.resolve(
          jsonResponse({
            provider,
            period: "current_month",
            currency: "USD",
            total,
            previous_total: total,
            change_pct: 0,
            trend: [],
          }),
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

    expect(await screen.findByText("USD 120.00")).toBeInTheDocument();
    expect(screen.getByText("USD 100.00")).toBeInTheDocument();
    expect(screen.getByText("USD 20.00")).toBeInTheDocument();
  });

  it("shows an error only for the provider whose request failed", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/costs/summary")) {
        if (url.includes("provider=oci")) {
          return Promise.resolve(jsonResponse({ detail: "boom" }, false, 500));
        }
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            total: 50,
            previous_total: 50,
            change_pct: 0,
            trend: [],
          }),
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

    // Combined total equals the AWS card's total here because the OCI request failed
    // (nothing to add), so both the combined KPI and the AWS card render "USD 50.00".
    expect(await screen.findAllByText("USD 50.00")).toHaveLength(2);
    expect(screen.getByText("Não foi possível carregar os custos de Oracle Cloud.")).toBeInTheDocument();
  });
});
