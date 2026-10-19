import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

interface CRLCountResponse {
  count: number;
}

const CRLComponent = () => {
  const [revokedCount, setRevokedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const controllerRef = useRef<AbortController | null>(null);

  const fetchCRLData = useCallback(async () => {
    // Cancel any previous request before starting another.
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    if (revokedCount === null) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const response = await axios.get<CRLCountResponse>("/api/crl/count", {
        signal: controller.signal,
      });

      const count = response.data?.count;

      if (
        typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count < 0
      ) {
        throw new Error("The server returned an invalid CRL count.");
      }

      setRevokedCount(count);
    } catch (err) {
      if (axios.isCancel(err)) {
        return;
      }

      setError(
        axios.isAxiosError(err)
          ? "Failed to load CRL data. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading CRL data.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }

      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [revokedCount]);

  useEffect(() => {
    void fetchCRLData();

    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchCRLData]);

  if (loading && revokedCount === null) {
    return (
      <section
        className="rounded-lg bg-white p-6 shadow"
        aria-busy="true"
        aria-label="Loading certificate revocation data"
      >
        <h3 className="mb-4 text-lg font-semibold">
          Certificate Revocation List
        </h3>

        <div className="animate-pulse" aria-hidden="true">
          <div className="mb-2 h-4 w-1/4 rounded bg-gray-200" />
          <div className="h-8 w-1/2 rounded bg-gray-200" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Certificate Revocation List</h3>

        <button
          type="button"
          onClick={() => void fetchCRLData()}
          disabled={refreshing}
          className="rounded border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh CRL data"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{error}</p>

          <button
            type="button"
            onClick={() => void fetchCRLData()}
            disabled={refreshing}
            className="mt-2 font-medium underline disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {revokedCount !== null && (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-gray-600">Revoked Certificates</span>

            <span
              className="text-2xl font-bold text-red-600"
              aria-live="polite"
            >
              {revokedCount.toLocaleString()}
            </span>
          </div>

          {error && (
            <p className="text-xs text-gray-500">
              Showing the last successfully retrieved count.
            </p>
          )}
        </>
      )}

      <div className="mt-4">
        <Link
          to="/revoke"
          className="block w-full rounded bg-red-600 px-4 py-2 text-center text-white transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Revoke Certificate
        </Link>
      </div>

      <div className="mt-4 space-y-1 text-sm text-gray-500">
        <p>✓ Revocation status monitoring</p>
        <p>✓ On-chain verification support</p>
        <p>✓ Merkle tree optimization support</p>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        The count reflects the most recent successful API response.
      </p>
    </section>
  );
};

export default CRLComponent;
