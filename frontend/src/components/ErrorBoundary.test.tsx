import React, { lazy, Suspense, useState } from "react";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

const render = (ui: React.ReactElement, initialEntries: string[] = ["/"]) =>
  rtlRender(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    ),
  });

function Boom({ message = "boom" }: { message?: string }): React.ReactElement {
  throw new Error(message);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when no error has occurred", () => {
    render(
      <ErrorBoundary>
        <p>safe content</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("safe content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders the default fallback and thrown error message", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom message="certificate exploded" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("certificate exploded")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("prefers a custom fallback when one is provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p>custom failure UI</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("custom failure UI")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls onReset when Try again is clicked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();
    const user = userEvent.setup();

    render(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("recovers when the underlying error condition is resolved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    function RecoverableApp() {
      const [shouldThrow, setShouldThrow] = useState(true);

      return (
        <ErrorBoundary onReset={() => setShouldThrow(false)}>
          {shouldThrow ? (
            <Boom message="temporary failure" />
          ) : (
            <p>recovered content</p>
          )}
        </ErrorBoundary>
      );
    }

    render(<RecoverableApp />);

    expect(screen.getByText("temporary failure")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("keeps unrelated UI available when a child component fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <p>outside content</p>
        <ErrorBoundary>
          <Boom message="isolated failure" />
        </ErrorBoundary>
      </>,
    );

    expect(screen.getByText("outside content")).toBeInTheDocument();
    expect(screen.getByText("isolated failure")).toBeInTheDocument();
  });

  it("resets the error when the route changes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    function RouteContent() {
      const { pathname } = useLocation();

      return pathname === "/" ? (
        <Boom message="home route failed" />
      ) : (
        <p>destination route content</p>
      );
    }

    render(
      <ErrorBoundary>
        <RouteContent />
        <Link to="/destination">Go to destination</Link>
      </ErrorBoundary>,
    );

    expect(screen.getByText("home route failed")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Go to destination" }));

    expect(
      await screen.findByText("destination route content"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("catches a rejected lazy import", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const FailingChunk = lazy(async () => {
      throw new Error(
        "Failed to fetch dynamically imported module: /assets/NotFound-abc123.js",
      );
    });

    render(
      <ErrorBoundary>
        <Suspense fallback={<p>loading</p>}>
          <FailingChunk />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to fetch dynamically imported module/),
    ).toBeInTheDocument();
  });

  it("continues to display the fallback if retrying does not fix the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <Boom message="persistent failure" />
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByText("persistent failure")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
