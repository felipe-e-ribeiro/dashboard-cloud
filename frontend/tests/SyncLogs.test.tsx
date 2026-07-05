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

describe("Sync logs page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a table of runs for AWS and switches to Oracle Cloud's history", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/sync/logs")) {
        const provider = url.includes("provider=oci") ? "oci" : "aws";
        if (provider === "oci") {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(
          jsonResponse([
            {
              id: 2,
              status: "success",
              started_at: "2026-07-04T03:00:00Z",
              finished_at: "2026-07-04T03:00:05Z",
              records_synced: 352,
              error_message: null,
            },
            {
              id: 1,
              status: "failed",
              started_at: "2026-07-03T03:00:00Z",
              finished_at: "2026-07-03T03:00:02Z",
              records_synced: 0,
              error_message: "boom",
            },
          ]),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/sync-logs"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("352")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Oracle Cloud" }));

    expect(await screen.findByText("Nenhuma sincronização registrada ainda.")).toBeInTheDocument();
  });

  it("navigates back to the dashboard from the header link", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/sync/logs")) return Promise.resolve(jsonResponse([]));
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
      if (url.includes("/api/sync/status")) {
        return Promise.resolve(
          jsonResponse({ provider: "aws", status: null, started_at: null, finished_at: null, error_message: null }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/sync-logs"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", { name: "Voltar ao dashboard" }));
    await user.click(await screen.findByRole("tab", { name: "AWS" }));

    expect(await screen.findByRole("button", { name: "Sincronizar agora" })).toBeInTheDocument();
  });
});
