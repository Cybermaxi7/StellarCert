import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { list, getMerkleRoot } = vi.hoisted(() => ({
  list: vi.fn(),
  getMerkleRoot: vi.fn(),
}));

vi.mock("../api", () => ({ crlApi: { list, getMerkleRoot } }));

import CrlPage from "./CrlPage";

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CrlPage />
    </QueryClientProvider>,
  );

describe("CrlPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue({
      data: [
        {
          certificateId: "CERT-1",
          issuerId: "iss-1",
          reason: "fraud",
          revokedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
    });
    getMerkleRoot.mockResolvedValue({
      computed: "abc",
      onChain: "abc",
      inSync: true,
      revokedCount: 25,
    });
  });

  it("shows revocations and both Merkle roots", async () => {
    renderPage();

    expect(await screen.findByText("CERT-1")).toBeTruthy();
    expect(await screen.findByTestId("crl-onchain")).toHaveProperty(
      "textContent",
      "abc",
    );
    expect(screen.getByTestId("crl-computed").textContent).toBe("abc");
    expect(screen.getByText(/In sync/)).toBeTruthy();
  });

  it("paginates and filters by issuer", async () => {
    renderPage();
    await screen.findByText("CERT-1");

    fireEvent.click(screen.getByText("Next"));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 2,
        limit: 10,
        issuerId: undefined,
      }),
    );

    fireEvent.change(screen.getByLabelText("Issuer ID"), {
      target: { value: "iss-1" },
    });
    fireEvent.click(screen.getByText("Filter"));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        issuerId: "iss-1",
      }),
    );
  });
});
