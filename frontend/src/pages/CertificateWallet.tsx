import { useEffect, useState } from "react";
import {
  Wallet,
  Download,
  Eye,
  Clock,
  QrCode,
  AlertCircle,
  Share2,
  Check,
} from "lucide-react";
import {
  Certificate,
  getUserCertificates,
  certificateApi,
  getCertificatePdfUrl,
} from "../api";
import QRCodeModal from "../components/QRCodeModal";

const CertificateWallet = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  // QR modal state (uses shared QRCodeModal component)
  const [qrModal, setQrModal] = useState<{
    isOpen: boolean;
    certificateId?: string | null;
    certificateName?: string | null;
  }>({ isOpen: false, certificateId: null, certificateName: null });

  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      setLoading(false);
      return;
    }

    const parsedUser = JSON.parse(user);

    const fetchCertificates = async () => {
      try {
        const data = await getUserCertificates(parsedUser.id);
        if (data) setCertificates(data);
      } catch (error) {
        console.error("Error fetching certificates:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, []);

  // ✅ QR CODE LOGIC: open shared QR modal which provides copy/download
  const handleShowQR = (certificateId: string, certificateName?: string) => {
    setQrModal({
      isOpen: true,
      certificateId,
      certificateName: certificateName || "Certificate",
    });
  };

  // ✅ SHARE LOGIC
  const handleShare = async (cert: Certificate) => {
    const serial = cert.serialNumber || cert.id;
    const url = `${window.location.origin}/verify?serial=${encodeURIComponent(serial)}`;

    const copyToClipboard = async () => {
      await navigator.clipboard.writeText(url);
      setCopiedId(cert.id);
      setTimeout(() => setCopiedId(null), 2000);
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: cert.title,
          text: `Check out my certificate: ${cert.title} — awarded to ${cert.recipientName}`,
          url,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  // ✅ PDF VIEW/DOWNLOAD LOGIC
  const handlePdfAction = async (
    cert: Certificate,
    action: "view" | "download",
  ) => {
    setError(null);
    setActionLoadingId(cert.id);

    try {
      let url: string | undefined | null = cert.pdfUrl;

      if (!url) {
        url = await getCertificatePdfUrl(cert.id);
      }

      if (!url) throw new Error("PDF not found");

      if (action === "view") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error("PDF unavailable");
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { certificateApi } from '../api/endpoints';

interface Certificate {
  id: string;
  title: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: 'active' | 'expired' | 'revoked';
  credentialHash: string;
}

const CertificateWallet: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

  const fetchCertificates = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await certificateApi.getAll({ userId: user.id });
      setCertificates(data.certificates || data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) fetchCertificates();
  }, [isAuthenticated, fetchCertificates]);

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `Certificate-${cert.serialNumber || cert.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to ${action} certificate "${cert.title}". ${message}`);
    } finally {
      setActionLoadingId(null);
    }
  };
  if (!isAuthenticated) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h2>
        <p className="text-gray-600">Please log in to view your certificate wallet.</p>
      </div>
    </div>
  );

  const filtered = filter === 'all' ? certificates : certificates.filter((c) => c.status === filter);
  const statusColor = (s: Certificate['status']) =>
    ({ active: 'bg-green-100 text-green-800', expired: 'bg-yellow-100 text-yellow-800', revoked: 'bg-red-100 text-red-800' }[s]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Certificate Wallet</h1>
        <p className="text-gray-600 mt-1">Welcome, {user.name}</p>
      </div>
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(['all', 'active', 'expired', 'revoked'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'}`}>
            {f}
          </button>
        ))}
      </div>
      {loading && <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" /></div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
          <button onClick={fetchCertificates} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading certificates...</p>
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">
            No Certificates Yet
          </h2>
          <p className="text-gray-500 mt-2">
            Your earned certificates will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between mb-4">
                <h3 className="text-xl font-semibold">{cert.title}</h3>
                <span
                  className={`px-2 py-1 text-sm rounded ${
                    cert.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {cert.status}
                </span>
              </div>

              <div className="mb-6 space-y-2 text-gray-600">
                <p>Issued to: {cert.recipientName}</p>
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {new Date(cert.issueDate).toLocaleDateString()}
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => handlePdfAction(cert, "view")}
                  disabled={actionLoadingId === cert.id}
                  className="flex items-center gap-2 text-blue-600 disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>

                <button
                  onClick={() => handleShowQR(cert.id, cert.title)}
                  className="flex items-center gap-2 text-purple-600"
                >
                  <QrCode className="w-4 h-4" />
                  QR
                </button>

                <button
                  onClick={() => handlePdfAction(cert, "download")}
                  disabled={actionLoadingId === cert.id}
                  className="flex items-center gap-2 text-green-600 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>

                <button
                  onClick={() => handleShare(cert)}
                  className="flex items-center gap-2 text-indigo-600"
                >
                  {copiedId === cert.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  {copiedId === cert.id ? "Copied!" : "Share"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Use shared QRCodeModal component for copy/download actions */}
      <QRCodeModal
        isOpen={!!qrModal.isOpen}
        onClose={() => setQrModal({ isOpen: false, certificateId: null })}
        certificateId={qrModal.certificateId ?? ""}
        certificateName={qrModal.certificateName ?? "Certificate"}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((cert) => (
          <div key={cert.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">{cert.title}</h3>
              <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor(cert.status)}`}>{cert.status}</span>
            </div>
            <p className="text-gray-600 text-sm mb-1"><span className="font-medium">Issuer:</span> {cert.issuer}</p>
            <p className="text-gray-600 text-sm mb-1"><span className="font-medium">Issued:</span> {new Date(cert.issuedDate).toLocaleDateString()}</p>
            {cert.expiryDate && <p className="text-gray-600 text-sm"><span className="font-medium">Expires:</span> {new Date(cert.expiryDate).toLocaleDateString()}</p>}
            <p className="text-xs text-gray-400 font-mono truncate mt-3">{cert.credentialHash}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CertificateWallet;
