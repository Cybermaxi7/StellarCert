import { useEffect, useState } from 'react';
import { Wallet, Download, Eye, Clock, QrCode, X, AlertCircle } from 'lucide-react';
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

  // ✅ PDF VIEW/DOWNLOAD LOGIC
  const handlePdfAction = async (cert: Certificate, action: 'view' | 'download') => {
    setError(null);
    setActionLoadingId(cert.id);

    try {
      let url: string | undefined | null = cert.pdfUrl;

      if (!url) {
        url = await getCertificatePdfUrl(cert.id);
      }

      if (!url) throw new Error('PDF not found');

      if (action === 'view') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error('PDF unavailable');

        const blob = await res.blob();
        const objectUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `Certificate-${cert.serialNumber || cert.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to ${action} certificate "${cert.title}". ${message}`);
    } finally {
      setActionLoadingId(null);
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
                <span className={`px-2 py-1 text-sm rounded ${
                  cert.status === 'active'
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