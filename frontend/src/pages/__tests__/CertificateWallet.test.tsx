import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

// Mock API and QR modal
vi.mock("../../api", () => {
  return {
    certificateApi: {
      getQR: vi.fn().mockResolvedValue("data:image/png;base64,MOCK"),
    },
    getUserCertificates: vi.fn().mockResolvedValue([
      {
        id: "cert1",
        serialNumber: "CERT-2026-001",
        title: "Blockchain Fundamentals",
        recipientName: "Alice Johnson",
        issueDate: new Date().toISOString(),
        status: "active",
        pdfUrl: "http://example.com/cert1.pdf",
      },
    ]),
    getCertificatePdfUrl: vi
      .fn()
      .mockResolvedValue("http://example.com/cert1.pdf"),
  };
});

vi.mock("../../components/QRCodeModal", () => ({
  default: ({ isOpen }: any) =>
    isOpen ? <div data-testid="qr-modal">QR</div> : null,
}));

import CertificateWallet from "../CertificateWallet";

describe("CertificateWallet", () => {
  beforeEach(() => {
    // Ensure a user is present in localStorage as the component reads it
    localStorage.setItem("user", JSON.stringify({ id: "u1" }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders certificates and opens QR modal and copies share link", async () => {
    // mock clipboard
    const writeText = vi.fn();
    // @ts-ignore
    navigator.clipboard = { writeText };

    render(<CertificateWallet />);

    await waitFor(() =>
      expect(screen.getByText(/Blockchain Fundamentals/i)).toBeInTheDocument(),
    );

    // QR button
    const qrButton = screen.getByRole("button", { name: /QR/i });
    fireEvent.click(qrButton);

    expect(await screen.findByTestId("qr-modal")).toBeInTheDocument();

    // Share button copies link
    const shareButton = screen.getByRole("button", { name: /Share|Copied!/i });
    fireEvent.click(shareButton);

    await waitFor(() => expect(writeText).toHaveBeenCalled());
  });
});

it('clears previous error before retrying', async () => {
  render(<CertificateWallet />);

  await user.click(claimButton);

  expect(
    screen.getByText(/failed/i),
  ).toBeInTheDocument();

  mockedClaim.mockResolvedValueOnce({});

  await user.click(claimButton);

  expect(
    screen.queryByText(/failed/i),
  ).not.toBeInTheDocument();
});