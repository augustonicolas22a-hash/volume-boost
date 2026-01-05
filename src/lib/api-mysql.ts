// Cliente API para MySQL (via Node.js backend)

function normalizeApiBase(url: string) {
  const base = url.replace(/\/+$/, "");
  // Se o usuário passar só o domínio (ex: https://api.site.com), adicionamos /api
  return base.endsWith("/api") ? base : `${base}/api`;
}

// Em produção (domínio), prefira mesma origem (Nginx faz proxy em /api)
// Isso evita problemas de CORS e principalmente "mixed content" (site em HTTPS chamando API em HTTP)
const RAW_ENV_API_URL = import.meta.env.VITE_API_URL as string | undefined;

const RAW_API_URL = (() => {
  if (RAW_ENV_API_URL) {
    // Se o painel estiver em HTTPS e a URL estiver em HTTP no mesmo host, faz upgrade para HTTPS
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      RAW_ENV_API_URL.startsWith('http://')
    ) {
      try {
        const parsed = new URL(RAW_ENV_API_URL);
        if (parsed.hostname === window.location.hostname) {
          parsed.protocol = 'https:';
          return parsed.toString().replace(/\/+$/, '');
        }
      } catch {
        // ignora e usa como veio
      }
    }
    return RAW_ENV_API_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:4000/api';
})();

const API_URL = normalizeApiBase(RAW_API_URL);

console.log('🔌 API URL configurada:', API_URL);
function getStoredSession(): { adminId: number; sessionToken: string } | null {
  const stored = localStorage.getItem('admin');
  if (!stored) return null;
  try {
    const admin = JSON.parse(stored);
    return { adminId: admin.id, sessionToken: admin.session_token };
  } catch {
    return null;
  }
}

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session) {
    headers['X-Admin-Id'] = String(session.adminId);
    headers['X-Session-Token'] = session.sessionToken;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    // Geralmente TypeError: Failed to fetch (DNS/SSL/CORS/preflight)
    throw new Error(
      `Falha ao conectar com a API (${API_URL}). Verifique se a URL existe, se há HTTPS válido e se o CORS permite a origem do painel.`
    );
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Erro de conexão' }));
    throw new Error(error.error || 'Erro na requisição');
  }

  return response.json();
}

export const mysqlApi = {
  auth: {
    login: async (email: string, key: string) => {
      const data = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, key })
      });
      return {
        admin: {
          id: data.admin.id,
          nome: data.admin.nome,
          email: data.admin.email,
          creditos: data.admin.creditos,
          rank: data.admin.rank,
          profile_photo: data.admin.profile_photo,
          pin: data.admin.pin ? true : false,
          session_token: data.admin.session_token
        }
      };
    },

    validatePin: async (adminId: number, pin: string) => {
      return fetchAPI('/auth/validate-pin', {
        method: 'POST',
        body: JSON.stringify({ adminId, pin })
      });
    },

    setPin: async (adminId: number, pin: string) => {
      return fetchAPI('/auth/set-pin', {
        method: 'POST',
        body: JSON.stringify({ adminId, pin })
      });
    },

    validateSession: async (adminId: number, sessionToken: string) => {
      return fetchAPI('/auth/validate-session', {
        method: 'POST',
        body: JSON.stringify({ adminId, sessionToken })
      });
    },

    logout: async (adminId: number) => {
      return fetchAPI('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ adminId })
      });
    },
  },

  admins: {
    getById: async (id: number) => {
      return fetchAPI(`/admins/${id}`);
    },

    getResellers: async (masterId: number) => {
      return fetchAPI(`/admins/resellers/${masterId}`);
    },

    getAllMasters: async () => {
      return fetchAPI('/admins/masters');
    },

    getAllResellers: async () => {
      return [];
    },

    search: async (query: string) => {
      return fetchAPI(`/admins/search/${encodeURIComponent(query)}`);
    },

    createMaster: async (params: { nome: string; email: string; key: string; criadoPor: number }) => {
      return fetchAPI('/admins/master', {
        method: 'POST',
        body: JSON.stringify(params)
      });
    },

    createReseller: async (params: { nome: string; email: string; key: string; criadoPor: number }) => {
      return fetchAPI('/admins/reseller', {
        method: 'POST',
        body: JSON.stringify(params)
      });
    },

    update: async (id: number, data: Partial<{ nome: string; email: string; key: string }>) => {
      return fetchAPI(`/admins/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    delete: async (id: number) => {
      return fetchAPI(`/admins/${id}`, {
        method: 'DELETE'
      });
    },

    getDashboardStats: async () => {
      return fetchAPI('/admins/stats/dashboard');
    },

    getDocumentStats: async (masterId: number) => {
      return fetchAPI(`/admins/stats/documents/${masterId}`);
    },

    getResellerDetails: async (resellerId: number) => {
      return fetchAPI(`/admins/reseller-details/${resellerId}`);
    },
  },

  credits: {
    transfer: async (fromAdminId: number, toAdminId: number, amount: number) => {
      return fetchAPI('/credits/transfer', {
        method: 'POST',
        body: JSON.stringify({ fromAdminId, toAdminId, amount })
      });
    },

    recharge: async (adminId: number, amount: number, unitPrice: number, totalPrice: number) => {
      return fetchAPI('/credits/recharge', {
        method: 'POST',
        body: JSON.stringify({ adminId, amount, unitPrice, totalPrice })
      });
    },

    getTransactions: async (adminId?: number) => {
      if (adminId) {
        return fetchAPI(`/credits/transactions/${adminId}`);
      }
      return fetchAPI('/credits/transactions/all');
    },

    getAllTransactions: async () => {
      return fetchAPI('/credits/transactions/all');
    },

    getBalance: async (adminId: number) => {
      return fetchAPI(`/credits/balance/${adminId}`);
    },

    getRevenue: async (year: number, month: number) => {
      return fetchAPI(`/credits/revenue/${year}/${month}`);
    },

    getMetrics: async () => {
      return fetchAPI('/credits/metrics');
    },

    getMonthlyData: async () => {
      return fetchAPI('/credits/monthly-data');
    },

    getMasterMetrics: async (masterId: number) => {
      return fetchAPI(`/credits/master-metrics/${masterId}`);
    },

    getMasterTransfers: async (masterId: number) => {
      return fetchAPI(`/credits/master-transfers/${masterId}`);
    },

    setMasterGoal: async (masterId: number, year: number, month: number, targetRevenue: number) => {
      return fetchAPI('/credits/master-goal', {
        method: 'POST',
        body: JSON.stringify({ masterId, year, month, targetRevenue })
      });
    },
  },

  payments: {
    createPix: async (credits: number, adminId: number, adminName: string, _sessionToken: string) => {
      return fetchAPI('/payments/create-pix', {
        method: 'POST',
        body: JSON.stringify({ credits, adminId, adminName })
      });
    },

    checkStatus: async (transactionId: string) => {
      return fetchAPI(`/payments/status/${transactionId}`);
    },

    getHistory: async (adminId: number) => {
      return fetchAPI(`/payments/history/${adminId}`);
    },

    getPriceTiers: async () => {
      try {
        return await fetchAPI('/payments/price-tiers');
      } catch {
        return [
          { id: 1, min_qty: 50, max_qty: 50, price: 1.40, is_active: true },
          { id: 2, min_qty: 100, max_qty: 100, price: 1.30, is_active: true },
          { id: 3, min_qty: 200, max_qty: 200, price: 1.20, is_active: true },
          { id: 4, min_qty: 300, max_qty: 300, price: 1.10, is_active: true },
          { id: 5, min_qty: 500, max_qty: 500, price: 1.00, is_active: true },
        ];
      }
    },

    getGoal: async (year: number, month: number) => {
      try {
        return await fetchAPI(`/payments/goal/${year}/${month}`);
      } catch {
        return { target_revenue: 0, current_revenue: 0 };
      }
    },

    setGoal: async (year: number, month: number, targetRevenue: number) => {
      return fetchAPI('/payments/goal', {
        method: 'POST',
        body: JSON.stringify({ year, month, targetRevenue })
      });
    },
  },

  health: async () => {
    try {
      await fetchAPI('/health');
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'error', timestamp: new Date().toISOString() };
    }
  },
};

export default mysqlApi;
