import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { providerStatusesResponse } from "./providerStatusFixture";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body } as Response;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input.toString();
}

describe("Settings page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads provider statuses and disables the toggle for an unconfigured provider", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/settings/providers")) {
        return Promise.resolve(
          jsonResponse([
            {
              provider: "aws",
              enabled: false,
              configured: true,
              last_validated_at: "2026-07-01T00:00:00Z",
              last_validation_status: "success",
              last_validation_error: null,
            },
            {
              provider: "oci",
              enabled: false,
              configured: false,
              last_validated_at: null,
              last_validation_status: null,
              last_validation_error: null,
            },
          ]),
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("AWS")).toBeInTheDocument();
    expect(screen.getByText("Oracle Cloud")).toBeInTheDocument();
    expect(screen.getByText(/Ainda não configurado/)).toBeInTheDocument();

    const toggles = screen.getAllByRole("checkbox");
    const awsToggle = toggles[0];
    const ociToggle = toggles[1];
    expect(awsToggle).not.toBeDisabled();
    expect(ociToggle).toBeDisabled();
  });

  it("submits the AWS form and shows the validation error on failure", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      const method = init?.method || "GET";
      if (url.includes("/auth/me")) {
        return Promise.resolve(jsonResponse({ id: 1, username: "admin", auth_provider: "local" }));
      }
      if (url.includes("/api/settings/providers/aws") && method === "PUT") {
        return Promise.resolve(jsonResponse({ detail: "InvalidClientTokenId" }, false, 400));
      }
      if (url.includes("/api/settings/providers")) {
        return Promise.resolve(jsonResponse(providerStatusesResponse({ aws: false, oci: false })));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await screen.findByText("AWS");

    await user.type(screen.getByLabelText("Access Key ID"), "AKIAWRONG");
    await user.type(screen.getByLabelText("Secret Access Key"), "wrong");
    await user.type(screen.getAllByLabelText("Região")[0], "us-east-1");
    await user.click(screen.getAllByRole("button", { name: "Testar e salvar" })[0]);

    expect(await screen.findByText("InvalidClientTokenId")).toBeInTheDocument();
  });
});
