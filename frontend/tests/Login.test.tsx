import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 401, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Login flow", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an error on invalid credentials", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Not authenticated" }, false)) // initial /auth/me
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid username or password" }, false)); // login attempt
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await screen.findByLabelText("Usuário");
    await user.type(screen.getByLabelText("Usuário"), "admin");
    await user.type(screen.getByLabelText("Senha"), "wrong");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid username or password");
  });

  it("logs in successfully and redirects to the dashboard", async () => {
    let loggedIn = false;

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      const method = init?.method || "GET";

      if (url.includes("/auth/login") && method === "POST") {
        loggedIn = true;
        return Promise.resolve(jsonResponse({ status: "ok" }));
      }
      if (url.includes("/auth/me")) {
        return Promise.resolve(
          loggedIn
            ? jsonResponse({ id: 1, username: "admin", auth_provider: "local" })
            : jsonResponse({}, false),
        );
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
        return Promise.resolve(jsonResponse({ provider: "aws", period: "current_month", currency: "USD", items: [] }));
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
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await screen.findByLabelText("Usuário");
    await user.type(screen.getByLabelText("Usuário"), "admin");
    await user.type(screen.getByLabelText("Senha"), "admin-password");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByText("Cloud Cost Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AWS" })).toBeInTheDocument();
  });
});
