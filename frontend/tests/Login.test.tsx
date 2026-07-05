import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 401, json: async () => body } as Response;
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
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false)) // initial /auth/me (not logged in)
      .mockResolvedValueOnce(jsonResponse({ status: "ok" })) // login
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: "admin", auth_provider: "local" })) // /auth/me after login
      .mockResolvedValueOnce(
        jsonResponse({ provider: "aws", period: "current_month", currency: "USD", total: 0, trend: [] }),
      )
      .mockResolvedValueOnce(jsonResponse({ provider: "aws", period: "current_month", currency: "USD", items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ provider: "aws", status: null, started_at: null, finished_at: null, error_message: null }),
      );
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
