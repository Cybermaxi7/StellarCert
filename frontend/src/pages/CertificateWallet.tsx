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
