import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { providerStatusesResponse } from "./providerStatusFixture";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Theme", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("follows the system's dark preference on first visit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(prefers-color-scheme: dark)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByLabelText("Usuário");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists a manual toggle across the stored preference", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
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
              total: 0,
              previous_total: 0,
              change_pct: null,
              trend: [],
            }),
          );
        }
        return Promise.resolve(jsonResponse({}));
      }),
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    const toggle = await screen.findByRole("button", { name: /mudar para tema/i });
    const initialTheme = document.documentElement.getAttribute("data-theme");

    await user.click(toggle);

    const nextTheme = document.documentElement.getAttribute("data-theme");
    expect(nextTheme).not.toBe(initialTheme);
    expect(window.localStorage.getItem("theme")).toBe(nextTheme);
  });
});
