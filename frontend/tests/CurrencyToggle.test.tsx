import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { providerStatusesResponse } from "./providerStatusFixture";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Currency toggle", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("refetches with currency=brl and displays the converted values", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/settings/providers")) {
        return Promise.resolve(jsonResponse(providerStatusesResponse()));
      }
      if (url.includes("/api/costs/summary")) {
        const isBrl = url.includes("currency=brl");
        const isOci = url.includes("provider=oci");
        const total = isOci ? (isBrl ? 100 : 50) : isBrl ? 550 : 100;
        return Promise.resolve(
          jsonResponse({
            provider: isOci ? "oci" : "aws",
            period: "current_month",
            currency: isBrl ? "BRL" : "USD",
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

    // Combined total: AWS (100) + OCI (50) in USD.
    expect(await screen.findByText("$150.00")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Mudar para Real" }));

    // Combined total: AWS (550) + OCI (100) in BRL.
    expect(await screen.findByText("R$ 650,00")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("currency=brl"), expect.anything());
  });

  it("persists the currency choice across reloads", async () => {
    window.localStorage.setItem("currency", "brl");

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
            currency: "BRL",
            total: 10,
            previous_total: 10,
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

    expect(await screen.findByRole("button", { name: "Mudar para Dólar" })).toBeInTheDocument();
  });
});
