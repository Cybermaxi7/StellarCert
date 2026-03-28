import { Link } from 'react-router-dom';
import { Award, Download, Search, Wallet, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { analyticsApi, UserRole } from '../api';
import type {
  ActivityItem,
  DashboardStats,
  IssuanceTrendPoint,
  StatusDistribution
} from '../api';
import AdminAnalyticsDashboard from './AdminAnalyticsDashboard';

type DateRange = {
  startDate: string;
  endDate: string;
};

type MetricCardProps = {
  label: string;
  value: number;
  accentClassName: string;
};

const MetricCard = ({ label, value, accentClassName }: MetricCardProps) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md dark:shadow-lg dark:border dark:border-slate-700 transition-colors duration-250">
    <p className="text-sm font-medium text-gray-500 dark:text-slate-400 transition-colors duration-250">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${accentClassName} dark:text-blue-400 transition-colors duration-250`}>{value}</p>
  </div>
);

type IssuanceChartProps = {
  data: IssuanceTrendPoint[];
};

const IssuanceChart = ({ data }: IssuanceChartProps) => {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No issuance data available for the selected period.
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));
  if (maxCount === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No certificates were issued in this period.
      </div>
    );
  }

  const chartHeight = 160;
  const chartWidth = 400;
  const padding = 24;
  const innerHeight = chartHeight - padding * 2;
  const barGap = 8;
  const barWidth =
    data.length > 0
      ? (chartWidth - padding * 2 - barGap * (data.length - 1)) / data.length
      : 0;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="h-48 w-full"
      aria-label="Certificate issuance over time"
    >
      {data.map((point, index) => {
        const barHeight = (point.count / maxCount) * innerHeight;
        const x = padding + index * (barWidth + barGap);
        const y = chartHeight - padding - barHeight;
        return (
          <g key={point.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              className="fill-blue-500/80"
            />
          </g>
        );
      })}
      {data.map((point, index) => {
        const x = padding + index * (barWidth + barGap) + barWidth / 2;
        const label = point.date.slice(5);
        return (
          <text
            key={`${point.date}-label`}
            x={x}
            y={chartHeight - 4}
            textAnchor="middle"
            className="fill-gray-500 text-[10px]"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
};

type StatusPieChartProps = {
  distribution: StatusDistribution;
};

const StatusPieChart = ({ distribution }: StatusPieChartProps) => {
  const total = distribution.active + distribution.revoked + distribution.expired;

  if (!total) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500">
        No certificates to display status distribution.
      </div>
    );
  }

  const radius = 64;
  const center = 80;

  const segments: Array<{
    key: keyof StatusDistribution;
    value: number;
    color: string;
    label: string;
  }> = [
    { key: 'active' as const, value: distribution.active, color: '#22c55e', label: 'Active' },
    { key: 'revoked' as const, value: distribution.revoked, color: '#ef4444', label: 'Revoked' },
    { key: 'expired' as const, value: distribution.expired, color: '#eab308', label: 'Expired' }
  ].filter((segment) => segment.value > 0);

  let startAngle = 0;

  const paths = segments.map((segment) => {
    const angle = (segment.value / total) * 360;
    const endAngle = startAngle + angle;
    const largeArcFlag = angle > 180 ? 1 : 0;

    const startRadians = ((startAngle - 90) * Math.PI) / 180;
    const endRadians = ((endAngle - 90) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRadians);
    const y1 = center + radius * Math.sin(startRadians);
    const x2 = center + radius * Math.cos(endRadians);
    const y2 = center + radius * Math.sin(endRadians);

    const d = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');

    const currentStartAngle = startAngle;
    startAngle = endAngle;

    return { segment, d, startAngle: currentStartAngle, endAngle };
  });

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 160 160"
        className="h-40 w-40"
        aria-label="Certificate status distribution"
      >
        {paths.map(({ segment, d }) => (
          <path key={segment.key} d={d} fill={segment.color} />
        ))}
        <circle cx={center} cy={center} r={28} fill="#ffffff" />
      </svg>
      <div className="space-y-2 text-sm">
        {segments.map((segment) => {
          const percentage = ((segment.value / total) * 100).toFixed(1);
          return (
            <div key={segment.key} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-gray-700">
                {segment.label}{' '}
                <span className="font-semibold text-gray-900">{segment.value}</span>{' '}
                <span className="text-gray-500">({percentage}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

type ActivityFeedProps = {
  items: ActivityItem[];
};

const ActivityFeed = ({ items }: ActivityFeedProps) => {
  if (!items.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-500">
        No recent activity yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {items.slice(0, 10).map((item, index) => (
        <li
          key={`${item.date}-${index}`}
          className="py-3 flex items-start justify-between"
        >
          <div>
            <p className="font-medium text-gray-900">{item.description}</p>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(item.date).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <span className="ml-4 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize text-white">
            {item.type === 'issue' && (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5">Issued</span>
            )}
            {item.type === 'verify' && (
              <span className="rounded-full bg-blue-500 px-2 py-0.5">Verified</span>
            )}
            {item.type === 'revoke' && (
              <span className="rounded-full bg-red-500 px-2 py-0.5">Revoked</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
};

const createInitialDateRange = (): DateRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
};

const IssuerDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(createInitialDateRange);
  const [filterDirty, setFilterDirty] = useState(false);
  const [revokedCount, setRevokedCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await analyticsApi.getDashboardSummary({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
        setStats(data);
        setRevokedCount(data?.revokedCertificates ?? 0);
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message)
            : 'Failed to load analytics';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [dateRange]);

  const statusDistribution: StatusDistribution = useMemo(() => {
    if (stats?.statusDistribution) {
      return stats.statusDistribution;
    }

    return {
      active: stats?.activeCertificates ?? 0,
      revoked: stats?.revokedCertificates ?? 0,
      expired: stats?.expiredCertificates ?? 0
    };
  }, [stats]);

  const handleDateChange = (field: keyof DateRange, value: string) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value
    }));
    setFilterDirty(true);
  };

  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsApi.getDashboardSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      setStats(data);
      setRevokedCount(data?.revokedCertificates ?? 0);
      setFilterDirty(false);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to load analytics';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = async () => {
    const initial = createInitialDateRange();
    setDateRange(initial);
    setFilterDirty(false);

    try {
      setLoading(true);
      setError(null);
      const data = await analyticsApi.getDashboardSummary({
        startDate: initial.startDate,
        endDate: initial.endDate
      });
      setStats(data);
      setRevokedCount(data?.revokedCertificates ?? 0);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Failed to load analytics';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!stats) return;

    const rows: string[][] = [];

    rows.push(['Metric', 'Value']);
    rows.push(['Total Certificates', String(stats.totalCertificates)]);
    rows.push(['Active Certificates', String(statusDistribution.active)]);
    rows.push(['Revoked Certificates', String(statusDistribution.revoked)]);
    rows.push(['Expired Certificates', String(statusDistribution.expired)]);
    rows.push(['Total Verifications', String(stats.totalVerifications)]);
    rows.push(['Verifications (24h)', String(stats.verifications24h)]);
    rows.push([]);

    rows.push(['Issuance Date', 'Certificates Issued']);
    (stats.issuanceTrend ?? []).forEach((point) => {
      rows.push([point.date, String(point.count)]);
    });
    rows.push([]);

    rows.push(['Status', 'Count']);
    rows.push(['Active', String(statusDistribution.active)]);
    rows.push(['Revoked', String(statusDistribution.revoked)]);
    rows.push(['Expired', String(statusDistribution.expired)]);

    const csvContent = rows
      .map((row) =>
        row
          .map((field) => {
            const value = String(field).replace(/"/g, '""');
            return `"${value}"`;
          })
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'issuer-analytics.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-250">
            Issuer Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400 transition-colors duration-250">
            Track certificate issuance trends, status distribution, and recent
            issuer activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!stats}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-250"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 rounded-lg bg-white dark:bg-slate-900 p-4 shadow-sm dark:shadow-lg dark:border dark:border-slate-700 md:grid-cols-[2fr,3fr] transition-colors duration-250">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 transition-colors duration-250">
            Date range
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <label htmlFor="startDate" className="text-xs font-medium text-gray-500 dark:text-slate-400 transition-colors duration-250">
                Start
              </label>
              <input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-250"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="endDate" className="text-xs font-medium text-gray-500 dark:text-slate-400 transition-colors duration-250">
                End
              </label>
              <input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="mt-1 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors duration-250"
              />
            </div>
            <div className="mt-4 flex items-center gap-2 md:mt-6">
              <button
                type="button"
                onClick={handleApplyFilters}
                disabled={
                  loading ||
                  !dateRange.startDate ||
                  !dateRange.endDate ||
                  !filterDirty
                }
                className="rounded-md bg-blue-600 dark:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-250"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={loading}
                className="rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors duration-250"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-4 text-xs text-gray-500 dark:text-slate-400 transition-colors duration-250">
          {loading && <span>Loading analytics…</span>}
          {error && !loading && <span className="text-red-500 dark:text-red-400 transition-colors duration-250">{error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard
          label="Total Certificates"
          value={stats?.totalCertificates ?? 0}
          accentClassName="text-blue-600"
        />
        <MetricCard
          label="Active Certificates"
          value={statusDistribution.active}
          accentClassName="text-emerald-600"
        />
        <MetricCard
          label="Revoked Certificates"
          value={statusDistribution.revoked}
          accentClassName="text-red-600"
        />
        <MetricCard
          label="Verifications (24h)"
          value={stats?.verifications24h ?? 0}
          accentClassName="text-purple-600"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white dark:bg-slate-900 p-6 shadow-md dark:shadow-lg dark:border dark:border-slate-700 transition-colors duration-250">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-250">Issuance over time</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 transition-colors duration-250">
            Daily certificate issuance for the selected date range.
          </p>
          <div className="mt-4">
            <IssuanceChart data={stats?.issuanceTrend ?? []} />
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-900 p-6 shadow-md dark:shadow-lg dark:border dark:border-slate-700 transition-colors duration-250">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-250">Status distribution</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 transition-colors duration-250">
            Breakdown of certificates by current status.
          </p>
          <div className="mt-4">
            <StatusPieChart distribution={statusDistribution} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[3fr,2fr]">
        <div className="rounded-lg bg-white dark:bg-slate-900 p-6 shadow-md dark:shadow-lg dark:border dark:border-slate-700 transition-colors duration-250">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-250">Recent activity</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 transition-colors duration-250">
            Latest certificate issuance and revocation events.
          </p>
          <div className="mt-4">
            <ActivityFeed items={stats?.recentActivity ?? []} />
          </div>
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-900 p-6 shadow-md dark:shadow-lg dark:border dark:border-slate-700 transition-colors duration-250">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-250">Quick actions</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 transition-colors duration-250">
            Common issuer workflows you can access from here.
          </p>
          <div className="mt-4 space-y-3">
            <Link
              to="/issue"
              className="flex items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-250"
            >
              <span>Issue new certificate</span>
              <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </Link>
            <Link
              to="/verify"
              className="flex items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-250"
            >
              <span>Verify existing certificate</span>
              <Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </Link>
            <Link
              to="/wallet"
              className="flex items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-250"
            >
              <span>Open certificate wallet</span>
              <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link
          to="/issue"
          className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md dark:shadow-lg dark:border dark:border-slate-700 hover:shadow-lg dark:hover:shadow-xl transition-all duration-250"
        >
          <Award className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-4 transition-colors duration-250" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-250">Issue Certificate</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 transition-colors duration-250">
            Create and issue new digital certificates
          </p>
        </Link>

        <Link
          to="/verify"
          className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md dark:shadow-lg dark:border dark:border-slate-700 hover:shadow-lg dark:hover:shadow-xl transition-all duration-250"
        >
          <Search className="w-12 h-12 text-green-600 dark:text-green-400 mb-4 transition-colors duration-250" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-250">Verify Certificate</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 transition-colors duration-250">
            Verify the authenticity of certificates
          </p>
        </Link>

        <Link
          to="/wallet"
          className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md dark:shadow-lg dark:border dark:border-slate-700 hover:shadow-lg dark:hover:shadow-xl transition-all duration-250"
        >
          <Wallet className="w-12 h-12 text-purple-600 dark:text-purple-400 mb-4 transition-colors duration-250" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-250">Certificate Wallet</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 transition-colors duration-250">
            View and manage your certificates
          </p>
        </Link>

        <Link
          to="/revoke"
          className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md dark:shadow-lg border border-red-200 dark:border-red-900/50 hover:shadow-lg dark:hover:shadow-xl transition-all duration-250"
        >
          <ShieldAlert className="w-12 h-12 text-red-600 dark:text-red-400 mb-4 transition-colors duration-250" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-250">Revoke Certificate</h3>
          <p className="text-sm text-gray-600 dark:text-slate-400 transition-colors duration-250">Manage certificate revocation list</p>
          <div className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium transition-colors duration-250">
            CRL Active • {revokedCount} revoked
          </div>
        </Link>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const userRole = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { role?: string } | null;
      return parsed?.role ?? null;
    } catch {
      return null;
    }
  }, []);

  if (userRole === UserRole.ADMIN) {
    return <AdminAnalyticsDashboard />;
  }

  return <IssuerDashboard />;
};

export default Dashboard;
