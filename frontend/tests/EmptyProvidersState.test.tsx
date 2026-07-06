import { render, screen } from "@testing-library/react";
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

function noProvidersEnabledFetch() {
  return vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes("/auth/me")) {
      return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
    }
    if (url.includes("/api/settings/providers")) {
      return Promise.resolve(jsonResponse(providerStatusesResponse({ aws: false, oci: false })));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

describe("Empty providers state", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a message linking to settings on the Dashboard when no provider is enabled", async () => {
    vi.stubGlobal("fetch", noProvidersEnabledFetch());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Nenhuma cloud configurada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar agora" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows a message linking to settings on the Sync Logs page when no provider is enabled", async () => {
    vi.stubGlobal("fetch", noProvidersEnabledFetch());

    render(
      <MemoryRouter initialEntries={["/sync-logs"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Nenhuma cloud configurada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar agora" })).toHaveAttribute("href", "/settings");
  });
});
