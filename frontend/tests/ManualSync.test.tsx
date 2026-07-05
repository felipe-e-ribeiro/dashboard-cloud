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

describe("Manual sync button", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables the button while syncing and refreshes data once the sync finishes", async () => {
    let syncStatusCalls = 0;
    let total = 0;

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      const method = init?.method || "GET";

      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/costs/summary")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            total,
            previous_total: 0,
            change_pct: null,
            trend: [],
          }),
        );
      }
      if (url.includes("/api/costs/breakdown")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", period: "current_month", currency: "USD", items: [] }),
        );
      }
      if (url.includes("/api/sync/trigger") && method === "POST") {
        return Promise.resolve(jsonResponse({ status: "started" }, true, 202));
      }
      if (url.includes("/api/sync/status")) {
        syncStatusCalls += 1;
        if (syncStatusCalls === 1) {
          return Promise.resolve(
            jsonResponse({ provider: "aws", status: null, started_at: null, finished_at: null, error_message: null }),
          );
        }
        if (syncStatusCalls === 2) {
          return Promise.resolve(
            jsonResponse({
              provider: "aws",
              status: "running",
              started_at: "2026-07-04T10:00:00Z",
              finished_at: null,
              error_message: null,
            }),
          );
        }
        total = 42;
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            status: "success",
            started_at: "2026-07-04T10:00:00Z",
            finished_at: "2026-07-04T10:00:05Z",
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

    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "AWS" }));

    const button = await screen.findByRole("button", { name: "Sincronizar agora" });
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Sincronizando..." })).toBeDisabled();

    // The component polls /api/sync/status every 3s (POLL_INTERVAL_MS) using real timers;
    // two poll cycles are needed here (running, then success), so allow enough real time.
    expect(await screen.findByRole("button", { name: "Sincronizar agora" }, { timeout: 10000 })).not.toBeDisabled();
    expect(await screen.findByText(/Total: USD 42/)).toBeInTheDocument();
  }, 15000);

  it("shows a message when the trigger is rejected (409) and leaves the button usable", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      const method = init?.method || "GET";

      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/costs/summary")) {
        return Promise.resolve(
          jsonResponse({
            provider: "aws",
            period: "current_month",
            currency: "USD",
            total: 0,
            previous_total: 0,
            change_pct: null,
            trend: [],
          }),
        );
      }
      if (url.includes("/api/costs/breakdown")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", period: "current_month", currency: "USD", items: [] }),
        );
      }
      if (url.includes("/api/sync/trigger") && method === "POST") {
        return Promise.resolve(jsonResponse({ detail: "A sync is already running for aws" }, false, 409));
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

    const button = await screen.findByRole("button", { name: "Sincronizar agora" });
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe uma sincronização em andamento para esta cloud.",
    );
    expect(screen.getByRole("button", { name: "Sincronizar agora" })).not.toBeDisabled();
  });
});
