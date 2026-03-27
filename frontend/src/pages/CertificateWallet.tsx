import { useEffect, useState } from 'react';
import { Wallet, Download, Eye, Clock, QrCode, X, AlertCircle, Share2, Check } from 'lucide-react';
import { Certificate, getUserCertificates, certificateApi, getCertificatePdfUrl } from '../api';

const CertificateWallet = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ QR states
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem('user');

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
        console.error('Error fetching certificates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, []);

  // ✅ QR CODE LOGIC
  const fetchQRCode = async (certificateId: string) => {
    if (qrCodes[certificateId]) return qrCodes[certificateId];

    setLoadingQR(prev => ({ ...prev, [certificateId]: true }));

    try {
      const qrCode = await certificateApi.getQR(certificateId);
      setQrCodes(prev => ({ ...prev, [certificateId]: qrCode }));
      return qrCode;
    } catch (error) {
      console.error('Error fetching QR code:', error);
      return null;
    } finally {
      setLoadingQR(prev => ({ ...prev, [certificateId]: false }));
    }
  };

  const handleShowQR = async (certificateId: string) => {
    const qrCode = await fetchQRCode(certificateId);
    if (qrCode) setSelectedQR(qrCode);
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
        if (err instanceof Error && err.name !== 'AbortError') {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  // ✅ PDF VIEW/DOWNLOAD LOGIC
  const handlePdfAction = async (cert: Certificate, action: 'view' | 'download') => {
    setError(null);
    setActionLoadingId(cert.id);

    try {
      let url: string | undefined | null = cert.pdfUrl;

      if (!url) {
        url = await getCertificatePdfUrl(cert.id);
      }

      // Validate URL before proceeding
      if (!url || url.trim() === '') {
        throw new Error('PDF URL not available');
      }

      // Check for placeholder/dummy URLs
      if (url.includes('/api/dummy-pdf/') || url.includes('/dummy-pdf/')) {
        throw new Error('PDF not yet available - certificate is being processed');
      }

      // Additional URL validation
      try {
        new URL(url); // Validate URL format
      } catch {
        throw new Error('Invalid PDF URL format');
      }

      if (action === 'view') {
        // Try to open in new tab with error handling
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          // Fallback: try to download instead
          console.warn('Popup blocked, falling back to download');
          await handlePdfDownload(url, cert);
        }
      } else {
        await handlePdfDownload(url, cert);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';

      // Provide more helpful error messages
      let userFriendlyMessage = message;
      if (message.includes('PDF not found')) {
        userFriendlyMessage = 'Certificate PDF is not available yet. Please try again later.';
      } else if (message.includes('not yet available')) {
        userFriendlyMessage = 'Certificate is still being processed. PDF will be available soon.';
      }

      setError(`Failed to ${action} certificate "${cert.title}". ${userFriendlyMessage}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper function for PDF download with retry logic
  const handlePdfDownload = async (url: string, cert: Certificate, retryCount = 0): Promise<void> => {
    const maxRetries = 2;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404 && retryCount < maxRetries) {
          console.warn(`PDF not found, retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          return handlePdfDownload(url, cert, retryCount + 1);
        }
        throw new Error(`PDF unavailable (${res.status})`);
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `Certificate-${cert.serialNumber || cert.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      if (retryCount >= maxRetries) {
        throw error;
      }
      throw error;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Wallet className="w-10 h-10 text-blue-600" />
        <h1 className="text-3xl font-bold">Certificate Wallet</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <p>{error}</p>
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
          <h2 className="text-xl font-semibold text-gray-600">No Certificates Yet</h2>
          <p className="text-gray-500 mt-2">Your earned certificates will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map(cert => (
            <div key={cert.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between mb-4">
                <h3 className="text-xl font-semibold">{cert.title}</h3>
                <span className={`px-2 py-1 text-sm rounded ${cert.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                  }`}>
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
                  onClick={() => handlePdfAction(cert, 'view')}
                  disabled={actionLoadingId === cert.id}
                  className="flex items-center gap-2 text-blue-600 disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>

                <button
                  onClick={() => handleShowQR(cert.id)}
                  disabled={loadingQR[cert.id]}
                  className="flex items-center gap-2 text-purple-600 disabled:opacity-50"
                >
                  {loadingQR[cert.id] ? (
                    <div className="animate-spin h-4 w-4 border-b-2 border-purple-600 rounded-full"></div>
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  QR
                </button>

                <button
                  onClick={() => handlePdfAction(cert, 'download')}
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
                  {copiedId === cert.id ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ QR MODAL */}
      {selectedQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full">
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">Certificate QR Code</h3>
              <button onClick={() => setSelectedQR(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <img src={selectedQR} className="mx-auto max-h-[300px]" />
            <p className="text-sm text-gray-600 text-center mt-4">
              Scan to verify certificate
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateWallet;