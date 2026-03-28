import {
  ActivityItem,
  ApiError,
  AuthResponse,
  Certificate,
  CertificateTemplate,
  CreateCertificateData,
  DashboardStats,
  IssuanceTrendPoint,
  PaginatedResponse,
  CertificateExportFilters,
  StatusDistribution,
  User,
  UserRole,
  VerificationResult,
  LoginCredentials,
  RegisterData,
  ProfileUpdateData,
  DailyVerificationStats,
  TotalCertificatesStats,
  TotalActiveUsersStats,
  IssuerStats,
  PaginatedActivityLog,
} from "./types";
import { tokenStorage } from "./tokens";

// Configuration flag - can be enabled via Vite env `VITE_USE_DUMMY_DATA` ("true"/"false").
// Defaults to `false` so the app uses real API endpoints unless explicitly overridden.
const VITE_USE_DUMMY = (
  import.meta as unknown as { env: Record<string, string> }
).env?.VITE_USE_DUMMY_DATA;
let USE_DUMMY_DATA = VITE_USE_DUMMY ? VITE_USE_DUMMY === "true" : false;
const API_URL_BASE =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_URL || "http://localhost:3000/api/v1";
export const API_URL = API_URL_BASE;

// Helper function to simulate API delay
const simulateDelay = () => new Promise((resolve) => setTimeout(resolve, 300));
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// Common error handler
const handleError = (error: unknown, endpointName: string): never => {
  console.error(`Error in ${endpointName}:`, error);
  const apiError: ApiError = {
    message:
      error instanceof Error ? error.message : "An unexpected error occurred",
    statusCode:
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode: number }).statusCode
        : 500,
    error:
      error && typeof error === "object" && "name" in error
        ? (error as { name: string }).name
        : "API Error",
  };
  throw apiError;
};

/**
 * Standardized API client for all requests
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const token = tokenStorage.getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        message: response.statusText || "API request failed",
        statusCode: response.status,
      }));

      if (response.status === 401) {
        tokenStorage.clearTokens();
      }

      throw errorData;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    if ((error as ApiError).statusCode) {
      throw error;
    }

    const apiError: ApiError = {
      message:
        error instanceof Error ? error.message : "An unexpected error occurred",
      statusCode: 0,
      error: "Network Error",
    };
    throw apiError;
  }
}

// Dummy data generators
const dummyData = {
  users: [
    {
      id: "1",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      role: UserRole.ISSUER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Smith",
      role: UserRole.RECIPIENT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as User[],

  certificates: [
    {
      id: "cert-1",
      serialNumber: "CERT-2023-001",
      recipientName: "John Doe",
      recipientEmail: "john@example.com",
      issueDate: new Date().toISOString(),
      expiryDate: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      issuerName: "StellarCert Academy",
      status: "active",
      title: "Blockchain Expert",
      courseName: "Stellar Fundamentals",
    },
    {
      id: "cert-2",
      serialNumber: "CERT-2023-002",
      recipientName: "Jane Smith",
      recipientEmail: "jane@example.com",
      issueDate: new Date().toISOString(),
      expiryDate: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      issuerName: "StellarCert Academy",
      status: "revoked",
      title: "Web3 Developer",
      courseName: "Smart Contract Development",
    },
  ] as Certificate[],

  templates: [
    {
      id: "template-default",
      name: "Default Template",
      description: "Standard academic certificate template",
      layoutUrl: "/templates/default.pdf",
      fields: ["name", "date", "course"],
      issuerId: "1",
    },
  ] as CertificateTemplate[],
};

// ==================== USER MANAGEMENT ====================

export const fetchUserByEmail = async (email: string): Promise<User | null> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const user = dummyData.users.find((user) => user.email === email);
    console.log("Dummy User Data:", user);
    return user || null;
  }

  try {
    return await apiClient<User | null>(`/users/email/${email}`);
  } catch (error) {
    return handleError(error, "fetchUserByEmail");
  }
};

export const userApi = {
    getProfile: async (): Promise<User> => {
        return apiClient<User>('/users/profile');
    },
    updateProfile: async (data: ProfileUpdateData): Promise<User> => {
        return apiClient<User>('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    getByEmail: fetchUserByEmail,
    listAll: async (params?: Record<string, string | number | boolean>): Promise<PaginatedResponse<User>> => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                searchParams.append(key, String(value));
            });
        }
        return apiClient<PaginatedResponse<User>>(`/users?${searchParams.toString()}`);
    },
};

// ==================== TEMPLATE MANAGEMENT ====================

export const fetchDefaultTemplate = async (): Promise<CertificateTemplate> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const template = dummyData.templates[0];
    console.log("Dummy Template Data:", template);
    return template;
  }

  try {
    return await apiClient<CertificateTemplate>("/templates/default");
  } catch (error) {
    return handleError(error, "fetchDefaultTemplate");
  }
};

export const templateApi = {
  list: async (): Promise<CertificateTemplate[]> => {
    return apiClient<CertificateTemplate[]>("/templates");
  },
  getDefaultTemplate: fetchDefaultTemplate,
};

// ==================== CERTIFICATE MANAGEMENT ====================

export const verifyCertificate = async (
  serialNumber: string,
): Promise<VerificationResult> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const certificate = dummyData.certificates.find(
      (cert) => cert.serialNumber === serialNumber,
    );
    const result: VerificationResult = certificate
      ? {
          isValid: certificate.status === "active",
          status: certificate.status === "active" ? "valid" : "revoked",
          certificate,
          verificationDate: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          message:
            certificate.status === "active"
              ? "Certificate is valid and active"
              : "Certificate has been revoked.",
          verificationId: `ver_${Date.now()}`,
        }
      : {
          isValid: false,
          status: "not_found",
          verificationDate: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          message: "Certificate not found",
          verificationId: `ver_${Date.now()}`,
        };
    console.log("Dummy Verification:", result);
    return result;
  }

  try {
    return await apiClient<VerificationResult>(
      `/certificates/${serialNumber}/verify`,
    );
  } catch (error) {
    return handleError(error, "verifyCertificate");
  }
};

export const createCertificate = async (
  data: CreateCertificateData,
): Promise<Certificate> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const newCertificate: Certificate = {
      id: `cert-${Date.now()}`,
      serialNumber: `CERT-${new Date().getFullYear()}-${Math.floor(
        Math.random() * 1000,
      )
        .toString()
        .padStart(3, "0")}`,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      title: "New Certificate",
      courseName: data.courseName,
      issuerName: "StellarCert Academy",
      issueDate: new Date().toISOString(),
      status: "active",
    };
    dummyData.certificates.push(newCertificate);
    console.log("Dummy certificate created:", newCertificate);
    return newCertificate;
  }

  try {
    return await apiClient<Certificate>("/certificates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (error) {
    return handleError(error, "createCertificate");
  }
};

export const revokeCertificate = async (
  id: string,
  reason: string,
): Promise<Certificate> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const certificate = dummyData.certificates.find((cert) => cert.id === id);
    if (certificate) {
      certificate.status = "revoked";
      console.log("Dummy certificate revoked:", certificate);
      return certificate;
    }
    throw new Error("Certificate not found");
  }

  try {
    return await apiClient<Certificate>(`/certificates/${id}/revoke`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
  } catch (error) {
    return handleError(error, "revokeCertificate");
  }
};

export const findCertBySerialNumber = async (
  serialNumber: string,
): Promise<Certificate | null> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const certificate = dummyData.certificates.find(
      (cert) => cert.serialNumber === serialNumber,
    );
    console.log("Dummy Certificate:", certificate);
    return certificate || null;
  }

  try {
    return await apiClient<Certificate | null>(
      `/certificates/serial/${serialNumber}`,
    );
  } catch (error) {
    return handleError(error, "findCertBySerialNumber");
  }
};

export const getCertificatePdfUrl = async (
  certificateId: string,
): Promise<string | null> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const certificate = dummyData.certificates.find(
      (cert) => cert.id === certificateId,
    );
    return certificate ? `/api/dummy-pdf/${certificateId}` : null;
  }

  try {
    const data = await apiClient<{ pdfUrl: string }>(
      `/certificates/${certificateId}/pdf`,
    );
    return data.pdfUrl;
  } catch (error) {
    return handleError(error, "getCertificatePdfUrl");
  }
};

export const getUserCertificates = async (
  userId: string,
): Promise<Certificate[]> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    return dummyData.certificates.filter(
      (cert) => cert.recipientEmail === userId || cert.id === userId,
    );
  }

  try {
    return await apiClient<Certificate[]>(`/certificates/user/${userId}`);
  } catch (error) {
    return handleError(error, "getUserCertificates");
  }
};

export const getCertificateQR = async (
  certificateId: string,
): Promise<string> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    // Return a dummy QR code URL (in real implementation, this would be actual QR code image)
    return `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJJIENvZGU6ICR7Y2VydGlmaWNhdGVJZH08L3RleHQ+Cjwvc3ZnPg==`;
  }

  try {
    const data = await apiClient<{ qrCode: string }>(
      `/certificates/${certificateId}/qr`,
    );
    return data.qrCode;
  } catch (error) {
    return handleError(error, "getCertificateQR");
  }
};

export const certificateApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Certificate>> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          searchParams.append(key, String(value));
        }
      });
    }
    return apiClient<PaginatedResponse<Certificate>>(
      `/certificates?${searchParams.toString()}`,
    );
  },
  create: createCertificate,
  verify: verifyCertificate,
  revoke: revokeCertificate,
  getById: async (id: string): Promise<Certificate> => {
    return apiClient<Certificate>(`/certificates/${id}`);
  },
  getUserCertificates,
  bulkExport: async (
    certificateIds: string[],
    filters?: CertificateExportFilters,
  ): Promise<Blob> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      // Create a dummy CSV blob
      const headers = [
        "ID",
        "Recipient Name",
        "Email",
        "Title",
        "Status",
        "Issue Date",
      ];
      const normalizedSearch = filters?.search?.trim().toLowerCase();
      const startDate = filters?.startDate ? new Date(filters.startDate) : null;
      const endDate = filters?.endDate ? new Date(filters.endDate) : null;

      const certs = dummyData.certificates.filter((certificate) => {
        const matchesIds =
          certificateIds.length === 0 ||
          certificateIds.includes(certificate.id);
        const matchesSearch =
          !normalizedSearch ||
          [
            certificate.id,
            certificate.serialNumber,
            certificate.recipientName,
            certificate.recipientEmail,
            certificate.title,
            certificate.issuerName,
          ].some((value) => value?.toLowerCase().includes(normalizedSearch));
        const matchesStatus =
          !filters?.status || certificate.status === filters.status;
        const issueDate = new Date(certificate.issueDate);
        const matchesStartDate = !startDate || issueDate >= startDate;
        const matchesEndDate = !endDate || issueDate <= endDate;

        return (
          matchesIds &&
          matchesSearch &&
          matchesStatus &&
          matchesStartDate &&
          matchesEndDate
        );
      });
      const rows = certs.map((c) => [
        c.id,
        c.recipientName,
        c.recipientEmail,
        c.title,
        c.status,
        c.issueDate,
      ]);
      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
      return new Blob([csv], { type: "text/csv" });
    }
    const response = await fetch(`${API_URL}/certificates/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenStorage.getAccessToken()}`,
      },
      body: JSON.stringify({ certificateIds, filters }),
    });
    if (!response.ok) {
      throw new Error("Export failed");
    }
    return response.blob();
  },
  bulkRevoke: async (
    certificateIds: string[],
    reason?: string,
  ): Promise<Certificate[]> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      const updatedCerts: Certificate[] = [];
      for (const id of certificateIds) {
        const cert = dummyData.certificates.find((c) => c.id === id);
        if (cert) {
          cert.status = "revoked";
          updatedCerts.push(cert);
        }
      }
      return updatedCerts;
    }
    return apiClient<Certificate[]>("/certificates/bulk-revoke", {
      method: "POST",
      body: JSON.stringify({ certificateIds, reason }),
    });
  },
  freeze: async (
    certificateId: string,
    reason: string,
    durationDays: number,
  ): Promise<Certificate> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      const cert = dummyData.certificates.find((c) => c.id === certificateId);
      if (cert) {
        cert.status = "frozen";
        cert.freezeReason = reason;
        cert.frozenAt = new Date().toISOString();
        const unfreezeDate = new Date();
        unfreezeDate.setDate(unfreezeDate.getDate() + durationDays);
        cert.unfreezeAt = unfreezeDate.toISOString();
        return cert;
      }
      throw new Error("Certificate not found");
    }
    return apiClient<Certificate>(`/certificates/${certificateId}/freeze`, {
      method: "POST",
      body: JSON.stringify({ reason, durationDays }),
    });
  },
  unfreeze: async (certificateId: string): Promise<Certificate> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      const cert = dummyData.certificates.find((c) => c.id === certificateId);
      if (cert) {
        cert.status = "active";
        cert.freezeReason = undefined;
        cert.frozenAt = undefined;
        cert.unfreezeAt = undefined;
        return cert;
      }
      throw new Error("Certificate not found");
    }
    return apiClient<Certificate>(`/certificates/${certificateId}/unfreeze`, {
      method: "POST",
    });
  },
  getQR: getCertificateQR,
};

export const certificateApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/certificates', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get(`/certificates/${id}`).then((r) => r.data),
  issue: (data: Record<string, unknown>) =>
    api.post('/certificates', data).then((r) => r.data),
  revoke: (id: string, reason: string) =>
    api.patch(`/certificates/${id}/revoke`, { reason }).then((r) => r.data),
  verify: (certificateId: string) =>
    api.get(`/certificates/verify/${certificateId}`).then((r) => r.data),
};

export const userApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get('/users', { params }).then((r) => r.data),
  getById: (id: string) =>
    api.get(`/users/${id}`).then((r) => r.data),
  updateRole: (id: string, role: string) =>
    api.patch(`/users/${id}/role`, { role }).then((r) => r.data),
  toggleStatus: (id: string, isActive: boolean) =>
    api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
// ==================== AUTHENTICATION ====================

export const loginApi = async (
  credentials: LoginCredentials,
): Promise<AuthResponse> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const user = dummyData.users.find((u) => u.email === credentials.email);
    if (user && credentials.password === "password123") {
      const response: AuthResponse = {
        user,
        accessToken: "dummy-access-token",
        refreshToken: "dummy-refresh-token",
      };
      tokenStorage.setAccessToken(response.accessToken);
      tokenStorage.setRefreshToken(response.refreshToken);
      return response;
    }
    throw new Error("Invalid credentials");
  }

  try {
    const response = await apiClient<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    tokenStorage.setAccessToken(response.accessToken);
    tokenStorage.setRefreshToken(response.refreshToken);
    return response;
  } catch (error) {
    return handleError(error, "loginApi");
  }
};

export const registerApi = async (
  data: RegisterData,
): Promise<AuthResponse> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    const newUser: User = {
      id: `user-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dummyData.users.push(newUser);
    const response: AuthResponse = {
      user: newUser,
      accessToken: "dummy-access-token",
      refreshToken: "dummy-refresh-token",
    };
    tokenStorage.setAccessToken(response.accessToken);
    tokenStorage.setRefreshToken(response.refreshToken);
    return response;
  }

  try {
    const response = await apiClient<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    tokenStorage.setAccessToken(response.accessToken);
    tokenStorage.setRefreshToken(response.refreshToken);
    return response;
  } catch (error) {
    return handleError(error, "registerApi");
  }
};

export const authApi = {
  login: loginApi,
  register: registerApi,
  logout: async (): Promise<void> => {
    try {
      if (!USE_DUMMY_DATA) {
        await apiClient("/auth/logout", { method: "POST" });
      }
    } finally {
      tokenStorage.clearTokens();
    }
  },
};

// Standalone exports for backward compatibility
export const login = loginApi;
export const register = registerApi;

// ==================== ANALYTICS & STATS ====================

type CertificateStatsResponse = {
  totalCertificates: number;
  activeCertificates: number;
  revokedCertificates: number;
  expiredCertificates: number;
  issuanceTrend: IssuanceTrendPoint[];
  verificationStats: {
    totalVerifications: number;
    successfulVerifications: number;
    failedVerifications: number;
    dailyVerifications: number;
    weeklyVerifications: number;
  };
};

const buildStatusDistributionFromCertificates = (
  certificates: Certificate[],
): StatusDistribution => {
  const base: StatusDistribution = {
    active: 0,
    revoked: 0,
    expired: 0,
  };

  for (const cert of certificates) {
    if (cert.status === "active") {
      base.active += 1;
    } else if (cert.status === "revoked") {
      base.revoked += 1;
    } else if (cert.status === "expired") {
      base.expired += 1;
    }
  }

  return base;
};

const buildIssuanceTrendFromCertificates = (
  certificates: Certificate[],
): IssuanceTrendPoint[] => {
  const map = new Map<string, number>();

  for (const cert of certificates) {
    const dateKey = cert.issueDate.slice(0, 10);
    const current = map.get(dateKey) ?? 0;
    map.set(dateKey, current + 1);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
};

const buildRecentActivityFromCertificates = (
  certificates: Certificate[],
): ActivityItem[] => {
  const items: ActivityItem[] = certificates.map((cert) => {
    const type = cert.status === "revoked" ? "revoke" : "issue";
    return {
      type,
      date: cert.issueDate,
      description:
        type === "issue"
          ? `Issued ${cert.title} to ${cert.recipientName}`
          : `Revoked ${cert.title} for ${cert.recipientName}`,
    };
  });

  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
};

export const dailyCertificateVerification =
  async (): Promise<DailyVerificationStats> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      return { count: Math.floor(Math.random() * 50) + 20 };
    }
    return apiClient<DailyVerificationStats>(
      "/certificates/stats/daily-verification",
    );
  };

export const totalCertificates = async (): Promise<TotalCertificatesStats> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    return { total: dummyData.certificates.length };
  }
  return apiClient<TotalCertificatesStats>("/certificates/stats/total");
};

export const totalActiveUsers = async (): Promise<TotalActiveUsersStats> => {
  if (USE_DUMMY_DATA) {
    await simulateDelay();
    return { total: dummyData.users.length };
  }
  return apiClient<TotalActiveUsersStats>("/users/stats/active");
};

export const analyticsApi = {
  getDashboardSummary: async (params?: {
    startDate?: string;
    endDate?: string;
    issuerId?: string;
  }): Promise<DashboardStats> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();

      let certificates = dummyData.certificates;

      if (params?.startDate && params?.endDate) {
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        certificates = certificates.filter((cert) => {
          const issuedAt = new Date(cert.issueDate);
          return issuedAt >= start && issuedAt <= end;
        });
      }

      const statusDistribution =
        buildStatusDistributionFromCertificates(certificates);
      const issuanceTrend = buildIssuanceTrendFromCertificates(certificates);
      const recentActivity = buildRecentActivityFromCertificates(certificates);

      const totalCertificatesCount = certificates.length;
      const totalVerifications = 1250;
      const verifications24h = 45;

      return {
        totalCertificates: totalCertificatesCount,
        activeCertificates: statusDistribution.active,
        revokedCertificates: statusDistribution.revoked,
        expiredCertificates: statusDistribution.expired,
        totalVerifications,
        verifications24h,
        totalUsers: dummyData.users.length,
        issuanceTrend,
        statusDistribution,
        recentActivity,
      };
    }

    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.issuerId) searchParams.set("issuerId", params.issuerId);

    const query = searchParams.toString();

    const data = await apiClient<CertificateStatsResponse>(
      `/certificates/stats${query ? `?${query}` : ""}`,
    );

    const statusDistribution: StatusDistribution = {
      active: data.activeCertificates,
      revoked: data.revokedCertificates,
      expired: data.expiredCertificates,
    };

    const dashboardStats: DashboardStats = {
      totalCertificates: data.totalCertificates,
      activeCertificates: data.activeCertificates,
      revokedCertificates: data.revokedCertificates,
      expiredCertificates: data.expiredCertificates,
      totalVerifications: data.verificationStats.totalVerifications,
      verifications24h: data.verificationStats.dailyVerifications,
      totalUsers: 0,
      issuanceTrend: data.issuanceTrend,
      statusDistribution,
      recentActivity: [],
    };

    return dashboardStats;
  },
};

export const adminAnalyticsApi = {
    getAnalytics: async (params?: {
        startDate?: string;
        endDate?: string;
    }): Promise<import('./types').AdminAnalytics> => {
        const searchParams = new URLSearchParams();
        if (params?.startDate) searchParams.set('startDate', params.startDate);
        if (params?.endDate) searchParams.set('endDate', params.endDate);
        const query = searchParams.toString();

        return apiClient<import('./types').AdminAnalytics>(
            `/admin/analytics${query ? `?${query}` : ''}`
        );
    },
};

export const auditApi = {
    searchLogs: async (params?: Record<string, string | number | boolean | undefined>): Promise<import('./types').AuditLogSearchResponse> => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && String(value) !== '') {
                    searchParams.set(key, String(value));
                }
            });
        }
        const query = searchParams.toString();
        return apiClient<import('./types').AuditLogSearchResponse>(
            `/audit/logs${query ? `?${query}` : ''}`
        );
    },
    getStatistics: async (params?: Record<string, string | number | boolean | undefined>): Promise<import('./types').AuditStatistics> => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && String(value) !== '') {
                    searchParams.set(key, String(value));
                }
            });
        }
        const query = searchParams.toString();
        return apiClient<import('./types').AuditStatistics>(
            `/audit/statistics${query ? `?${query}` : ''}`
        );
    },
    exportCsvUrl: (params?: Record<string, string | number | boolean | undefined>): string => {
        const searchParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && String(value) !== '') {
                    searchParams.set(key, String(value));
                }
            });
        }
        const query = searchParams.toString();
        return `${API_URL}/audit/export${query ? `?${query}` : ''}`;
    },
};

// Toggle dummy data
export const toggleDummyData = (useDummy: boolean) => {
  USE_DUMMY_DATA = useDummy;
  console.log(`Using ${useDummy ? "dummy" : "real"} data`);
};

export const issuerProfileApi = {
  getStats: async (): Promise<IssuerStats> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      return {
        totalCertificates: 125,
        activeCertificates: 118,
        revokedCertificates: 7,
        expiredCertificates: 0,
        totalVerifications: 2847,
        lastLogin: new Date().toISOString(),
      };
    }
    return apiClient<IssuerStats>("/users/profile/stats");
  },

  getActivity: async (
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedActivityLog> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      const mockActivities = [
        {
          id: "1",
          action: "ISSUE_CERTIFICATE",
          description:
            'Issued "Blockchain Fundamentals" certificate to Alice Johnson',
          ipAddress: "192.168.1.100",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "2",
          action: "REVOKE_CERTIFICATE",
          description: "Revoked certificate #CERT-2024-045",
          ipAddress: "192.168.1.100",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          timestamp: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          id: "3",
          action: "UPDATE_PROFILE",
          description: "Updated organization details",
          ipAddress: "192.168.1.100",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          timestamp: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ];

      const total = mockActivities.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const activities = mockActivities.slice(startIndex, endIndex);

      return {
        activities,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    }
    return apiClient<PaginatedActivityLog>(
      `/users/profile/activity?page=${page}&limit=${limit}`,
    );
  },
  getProfile: (issuerId: string) =>
    api.get(`/issuers/${issuerId}/profile`).then((r) => r.data),
  updateProfile: (issuerId: string, data: Record<string, unknown>) =>
    api.put(`/issuers/${issuerId}/profile`, data).then((r) => r.data),
  getStats: (issuerId: string) =>
    api.get(`/issuers/${issuerId}/stats`).then((r) => r.data),
  getActivity: (issuerId: string, params?: Record<string, unknown>) =>
    api.get(`/issuers/${issuerId}/activity`, { params }).then((r) => r.data),
    getStats: async (): Promise<IssuerStats> => {
        if (USE_DUMMY_DATA) {
            await simulateDelay();
            return {
                totalCertificates: 125,
                activeCertificates: 118,
                revokedCertificates: 7,
                expiredCertificates: 0,
                totalVerifications: 2847,
                lastLogin: new Date().toISOString()
            };
        }
        return apiClient<IssuerStats>('/users/profile/stats');
    },

    getActivity: async (page: number = 1, limit: number = 10): Promise<PaginatedActivityLog> => {
        if (USE_DUMMY_DATA) {
            await simulateDelay();
            const mockActivities = [
                {
                    id: '1',
                    action: 'ISSUE_CERTIFICATE',
                    description: 'Issued "Blockchain Fundamentals" certificate to Alice Johnson',
                    ipAddress: '192.168.1.100',
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                },
                {
                    id: '2',
                    action: 'REVOKE_CERTIFICATE',
                    description: 'Revoked certificate #CERT-2024-045',
                    ipAddress: '192.168.1.100',
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    id: '3',
                    action: 'UPDATE_PROFILE',
                    description: 'Updated organization details',
                    ipAddress: '192.168.1.100',
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
                }
            ];

            const total = mockActivities.length;
            const totalPages = Math.ceil(total / limit);
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const activities = mockActivities.slice(startIndex, endIndex);

            return {
                activities,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages
                }
            };
        }
        return apiClient<PaginatedActivityLog>(`/users/profile/activity?page=${page}&limit=${limit}`);
    },

    updateProfile: async (data: ProfileUpdateData): Promise<User> => {
        return apiClient<User>('/users/profile/issuer', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

  updateProfile: async (data: ProfileUpdateData): Promise<User> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      // In a real implementation, this would update the user data
      return dummyData.users[0]; // Return first user as example
    }
    return apiClient<User>("/users/profile/issuer", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  uploadProfilePicture: async (
    file: File,
  ): Promise<{ profilePicture: string; message: string }> => {
    if (USE_DUMMY_DATA) {
      await simulateDelay();
      return {
        profilePicture: URL.createObjectURL(file),
        message: "Profile picture uploaded successfully",
      };
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/users/profile/picture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenStorage.getAccessToken() ?? ""}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        message: response.statusText || "Profile picture upload failed",
        statusCode: response.status,
      }));

      throw errorData;
    }

    return response.json();
  },
};

export default api;
