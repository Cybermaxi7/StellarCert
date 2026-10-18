import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { crlApi } from "../api";
import { queryKeys } from "../api/queries";

const PAGE_SIZE = 10;

const CrlPage = () => {
  const [page, setPage] = useState(1);
  const [issuerInput, setIssuerInput] = useState("");
  const [issuerId, setIssuerId] = useState("");

  const list = useQuery({
    queryKey: queryKeys.crl.list({ page, issuerId }),
    queryFn: () =>
      crlApi.list({ page, limit: PAGE_SIZE, issuerId: issuerId || undefined }),
    placeholderData: keepPreviousData,
  });

  const root = useQuery({
    queryKey: queryKeys.crl.merkleRoot(),
    queryFn: () => crlApi.getMerkleRoot(),
  });

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setIssuerId(issuerInput.trim());
  };

  const totalPages = Math.max(1, list.data?.totalPages ?? 1);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Certificate Revocation List</h1>

      <section
        aria-label="Merkle root"
        className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 space-y-3"
      >
        <h2 className="text-lg font-semibold">Merkle root</h2>
        {root.isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : root.isError || !root.data ? (
          <p role="alert" className="text-sm text-red-600">
            Failed to load Merkle root
          </p>
        ) : (
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-gray-500">Computed from revocations</dt>
              <dd className="font-mono break-all" data-testid="crl-computed">
                {root.data.computed}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">On-chain</dt>
              <dd className="font-mono break-all" data-testid="crl-onchain">
                {root.data.onChain ?? "Unavailable"}
              </dd>
            </div>
            <div data-testid="crl-sync">
              {root.data.inSync === null
                ? "On-chain value could not be read"
                : root.data.inSync
                  ? "✓ In sync with the chain"
                  : "⚠ Out of sync with the chain"}
            </div>
          </dl>
        )}
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 space-y-4">
        <form onSubmit={applyFilter} className="flex gap-2">
          <input
            aria-label="Issuer ID"
            value={issuerInput}
            onChange={(e) => setIssuerInput(e.target.value)}
            placeholder="Filter by issuer ID"
            className="flex-1 border rounded px-3 py-2 text-sm dark:bg-slate-800"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Filter
          </button>
        </form>

        {list.isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : list.isError ? (
          <p role="alert" className="text-sm text-red-600">
            Failed to load revocations
          </p>
        ) : !list.data || list.data.data.length === 0 ? (
          <p className="text-sm text-gray-500">No revoked certificates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4">Certificate</th>
                  <th className="py-2 pr-4">Issuer</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2">Revoked</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((entry) => (
                  <tr key={entry.certificateId} className="border-b">
                    <td className="py-2 pr-4 font-mono">
                      {entry.certificateId}
                    </td>
                    <td className="py-2 pr-4 font-mono break-all">
                      {entry.issuerId}
                    </td>
                    <td className="py-2 pr-4">{entry.reason ?? "—"}</td>
                    <td className="py-2">
                      {new Date(entry.revokedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
};

export default CrlPage;
