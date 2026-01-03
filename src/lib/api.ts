// Cliente API para comunicação com o backend Node.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || 'Erro na requisição');
  }

  return response.json();
}

// Auth
export const api = {
  auth: {
    login: (email: string, key: string) =>
      request<{ admin: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, key }),
      }),

    validatePin: (adminId: number, pin: string) =>
      request<{ valid: boolean }>('/auth/validate-pin', {
        method: 'POST',
        body: JSON.stringify({ adminId, pin }),
      }),

    setPin: (adminId: number, pin: string) =>
      request<{ success: boolean }>('/auth/set-pin', {
        method: 'POST',
        body: JSON.stringify({ adminId, pin }),
      }),

    validateSession: (adminId: number, sessionToken: string) =>
      request<{ valid: boolean }>('/auth/validate-session', {
        method: 'POST',
        body: JSON.stringify({ adminId, sessionToken }),
      }),

    logout: (adminId: number) =>
      request<{ success: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ adminId }),
      }),
  },

  admins: {
    getById: (id: number) => request<any>(`/admins/${id}`),

    getResellers: (masterId: number) => request<any[]>(`/admins/resellers/${masterId}`),

    getAllMasters: () => request<any[]>('/admins/masters'),

    getAllResellers: () => request<any[]>('/admins/all-resellers'),

    search: (query: string) => request<any[]>(`/admins/search/${encodeURIComponent(query)}`),

    createMaster: (data: { nome: string; email: string; key: string; criadoPor: number }) =>
      request<any>('/admins/master', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    createReseller: (data: { nome: string; email: string; key: string; criadoPor: number }) =>
      request<any>('/admins/reseller', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: number, data: Partial<{ nome: string; email: string; key: string }>) =>
      request<{ success: boolean }>(`/admins/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      request<{ success: boolean }>(`/admins/${id}`, {
        method: 'DELETE',
      }),

    getDashboardStats: () =>
      request<{ totalMasters: number; totalResellers: number; totalCredits: number }>(
        '/admins/stats/dashboard'
      ),
  },

  credits: {
    transfer: (fromAdminId: number, toAdminId: number, amount: number) =>
      request<{ success: boolean }>('/credits/transfer', {
        method: 'POST',
        body: JSON.stringify({ fromAdminId, toAdminId, amount }),
      }),

    recharge: (adminId: number, amount: number, unitPrice: number, totalPrice: number) =>
      request<{ success: boolean }>('/credits/recharge', {
        method: 'POST',
        body: JSON.stringify({ adminId, amount, unitPrice, totalPrice }),
      }),

    getTransactions: (adminId?: number) => 
      request<any[]>(adminId ? `/credits/transactions/${adminId}` : '/credits/transactions'),

    getAllTransactions: () => request<any[]>('/credits/transactions/all'),

    getBalance: (adminId: number) => request<{ credits: number }>(`/credits/balance/${adminId}`),

    getRevenue: (year: number, month: number) =>
      request<{ revenue: number }>(`/credits/revenue/${year}/${month}`),

    getMetrics: () => request<{
      totalDeposits: number;
      totalDepositValue: number;
      totalTransfers: number;
      totalTransferCredits: number;
      avgTicket: number;
    }>('/credits/metrics'),

    getMonthlyData: () => request<Array<{
      month: string;
      deposits: number;
      transfers: number;
    }>>('/credits/monthly-data'),
  },

  payments: {
    createPix: (credits: number, adminId: number, adminName: string, sessionToken: string) =>
      request<{
        transactionId: string;
        amount: number;
        credits: number;
        qrCode: string;
        qrCodeBase64: string;
      }>('/payments/pix/create', {
        method: 'POST',
        body: JSON.stringify({ credits, adminId, adminName, sessionToken }),
      }),

    checkStatus: (transactionId: string) =>
      request<any>(`/payments/pix/status/${transactionId}`),

    getHistory: (adminId: number) =>
      request<any[]>(`/payments/history/${adminId}`),

    getPriceTiers: () => request<any[]>('/payments/price-tiers'),

    getGoal: (year: number, month: number) =>
      request<{ target_revenue: number; current_revenue: number }>(`/payments/goals/${year}/${month}`),

    setGoal: (year: number, month: number, targetRevenue: number) =>
      request<{ success: boolean }>('/payments/goals', {
        method: 'POST',
        body: JSON.stringify({ year, month, targetRevenue }),
      }),
  },

  health: () => request<{ status: string; timestamp: string }>('/health'),
};

export default api;
