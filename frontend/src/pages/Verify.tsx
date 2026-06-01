<<
import React, { useState } from 'react';
import { certificateApi } from '../api/endpoints';
import type { VerificationResult } from '../api/types';

const Verify: React.FC = () => {
  const [certificateId, setCertificateId] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    const trimmed = certificateId.trim();

    if (!trimmed) {
      setError('Please enter a Certificate ID or Hash.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await certificateApi.verify(trimmed);
      setResult(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const verificationTimestamp =
    result?.verifiedAt ?? result?.verificationDate;

  const styles: Record<
    NonNullable<VerificationResult['status']>,
    { bg: string; border: string; text: string; icon: string; label: string }
  > = {
    valid: {
      bg: 'bg-green-50',
      border: 'border-green-400',
      text: 'text-green-800',
      icon: 'OK',
      label: 'Valid',
    },
    revoked: {
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      text: 'text-orange-800',
      icon: 'RV',
      label: 'Revoked',
    },
    expired: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-400',
      text: 'text-yellow-800',
      icon: 'EX',
      label: 'Expired',
    },
    not_found: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      text: 'text-red-800',
      icon: 'NO',
      label: 'Not Found',
    },
  };

  const statusStyle =
    result?.status && styles[result.status]
      ? styles[result.status]
      : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Verify Certificate
        </h1>
        <p className="text-gray-600">
          Enter a certificate ID or credential hash to check its authenticity.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Certificate ID / Hash
        </label>

        <div className="flex gap-3">
          <input
            type="text"
            value={certificateId}
            onChange={(e) => setCertificateId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
            placeholder="e.g. CERT-2024-XXXXXXXX"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => void handleVerify()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && statusStyle && (
          <div
            className={`mt-6 ${statusStyle.bg} border-2 ${statusStyle.border} rounded-xl p-6`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-semibold">
                {statusStyle.icon}
              </span>

              <div>
                <h3 className={`text-xl font-bold ${statusStyle.text}`}>
                  {statusStyle.label}
                </h3>

                {verificationTimestamp && (
                  <p className="text-xs text-gray-500">
                    Verified at{' '}
                    {new Date(verificationTimestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {result.message && (
              <p className="text-gray-700 text-sm mb-4">
                {result.message}
              </p>
            )}

            {result.certificate && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">
                    Title
                  </span>
                  <p>{result.certificate.title}</p>
                </div>

                <div>
                  <span className="font-medium text-gray-600">
                    Issuer
                  </span>
                  <p>{result.certificate.issuerName}</p>
                </div>

                <div>
                  <span className="font-medium text-gray-600">
                    Recipient
                  </span>
                  <p>{result.certificate.recipientName}</p>
                </div>

                <div>
                  <span className="font-medium text-gray-600">
                    Issued
                  </span>
                  <p>
                    {new Date(
                      result.certificate.issueDate,
                    ).toLocaleDateString()}
                  </p>
                </div>

                {result.certificate.expiryDate && (
                  <div>
                    <span className="font-medium text-gray-600">
                      Expires
                    </span>
                    <p>
                      {new Date(
                        result.certificate.expiryDate,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {result.certificate.txHash && (
                  <div className="col-span-2 pt-2 border-t border-gray-200">
                    <span className="font-medium text-gray-600 text-xs">
                      Transaction Hash
                    </span>

                    <p className="font-mono text-xs text-gray-500 break-all mt-1">
                      {result.certificate.txHash}
                    </p>
                  </div>
                )}

                {result.certificate.cid && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600 text-xs">
                      IPFS CID
                    </span>

                    <p className="font-mono text-xs text-gray-500 break-all mt-1">
                      {result.certificate.cid}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Verify;
export { default } from './VerifyCertificate';
