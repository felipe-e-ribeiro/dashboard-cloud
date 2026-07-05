import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("switches between AWS and Oracle Cloud tabs", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/costs/summary")) {
        const provider = url.includes("provider=oci") ? "oci" : "aws";
        return Promise.resolve(
          jsonResponse({ provider, period: "current_month", currency: "USD", total: 42, trend: [] }),
        );
      }
      if (url.includes("/api/costs/breakdown")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", period: "current_month", currency: "USD", items: [] }),
        );
      }
      if (url.includes("/api/sync/status")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            status: "success",
            started_at: null,
            finished_at: null,
            error_message: null,
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

    expect(await screen.findByText(/Total: USD 42/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Oracle Cloud" }));

    expect(await screen.findByRole("tab", { name: "Oracle Cloud" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows a warning when the last sync failed", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/costs/summary")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", period: "current_month", currency: "USD", total: 0, trend: [] }),
        );
      }
      if (url.includes("/api/costs/breakdown")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", period: "current_month", currency: "USD", items: [] }),
        );
      }
      if (url.includes("/api/sync/status")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            status: "failed",
            started_at: null,
            finished_at: null,
            error_message: "credenciais inválidas",
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

    expect(await screen.findByRole("alert")).toHaveTextContent("credenciais inválidas");
  });
});
