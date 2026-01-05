// Cliente API para PostgreSQL (Supabase/Cloud)
import { supabase } from '@/integrations/supabase/client';

// Helper para obter dados da sessão armazenada
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

export const supabaseApi = {
  auth: {
    login: async (email: string, key: string) => {
      const { data, error } = await supabase.rpc('validate_login', {
        p_email: email,
        p_key: key
      } as any);

      if (error) {
        console.error('Login error:', error);
        throw new Error(error.message);
      }
      
      const adminData = Array.isArray(data) ? data[0] : data;
      
      if (!adminData) throw new Error('Email ou senha incorretos');

      return {
        admin: {
          id: adminData.id,
          nome: adminData.nome,
          email: adminData.email,
          creditos: adminData.creditos,
          rank: adminData.rank,
          profile_photo: adminData.profile_photo,
          pin: adminData.has_pin,
          session_token: adminData.session_token
        }
      };
    },

    validatePin: async (adminId: number, pin: string) => {
      const { data, error } = await supabase.rpc('validate_pin', {
        p_admin_id: adminId,
        p_pin: pin
      });

      if (error) throw new Error(error.message);
      return { valid: data === true };
    },

    setPin: async (adminId: number, pin: string) => {
      const { data, error } = await supabase.rpc('set_admin_pin', {
        p_admin_id: adminId,
        p_pin: pin
      });

      if (error) throw new Error(error.message);
      return { success: data === true };
    },

    validateSession: async (adminId: number, sessionToken: string) => {
      const { data, error } = await supabase.rpc('is_valid_admin', {
        p_admin_id: adminId,
        p_session_token: sessionToken
      });

      if (error) return { valid: false };
      return { valid: data === true };
    },

    logout: async (adminId: number) => {
      const { data, error } = await supabase.rpc('logout_admin', {
        p_admin_id: adminId
      });

      if (error) throw new Error(error.message);
      return { success: data === true };
    },
  },

  admins: {
    getById: async (id: number) => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('get_admin_by_id', {
        p_admin_id: id,
        p_session_token: session.sessionToken
      });

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('Admin não encontrado');
      return data[0];
    },

    getResellers: async (masterId: number) => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('get_resellers_by_master', {
        p_master_id: masterId,
        p_session_token: session.sessionToken
      });

      if (error) throw new Error(error.message);
      return data || [];
    },

    getAllMasters: async () => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('get_all_masters', {
        p_admin_id: session.adminId,
        p_session_token: session.sessionToken
      });

      if (error) throw new Error(error.message);
      return data || [];
    },

    getAllResellers: async () => {
      return [];
    },

    search: async (query: string) => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('search_admins', {
        p_admin_id: session.adminId,
        p_session_token: session.sessionToken,
        p_query: query
      });

      if (error) throw new Error(error.message);
      return data || [];
    },

    createMaster: async (params: { nome: string; email: string; key: string; criadoPor: number }) => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('create_master', {
        p_creator_id: params.criadoPor,
        p_session_token: session.sessionToken,
        p_nome: params.nome,
        p_email: params.email,
        p_key: params.key
      });

      if (error) throw new Error(error.message);
      return { id: data };
    },

    createReseller: async (params: { nome: string; email: string; key: string; criadoPor: number }) => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('create_reseller', {
        p_creator_id: params.criadoPor,
        p_session_token: session.sessionToken,
        p_nome: params.nome,
        p_email: params.email,
        p_key: params.key
      });

      if (error) throw new Error(error.message);
      return { id: data };
    },

    update: async (_id: number, _data: Partial<{ nome: string; email: string; key: string }>) => {
      throw new Error('Função não implementada');
    },

    delete: async (_id: number) => {
      throw new Error('Função não implementada');
    },

    getDashboardStats: async () => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_admin_id: session.adminId,
        p_session_token: session.sessionToken
      });

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { totalMasters: 0, totalResellers: 0, totalCredits: 0 };
      
      return {
        totalMasters: Number(data[0].total_masters) || 0,
        totalResellers: Number(data[0].total_resellers) || 0,
        totalCredits: Number(data[0].total_credits) || 0
      };
    },

    getDocumentStats: async (_masterId: number) => {
      // Supabase não tem as tabelas de documentos, retorna vazio
      return {
        totalDocuments: 0,
        totalCnh: 0,
        totalRg: 0,
        totalCarteira: 0,
        byReseller: []
      };
    },

    getResellerDetails: async (_resellerId: number) => {
      // Supabase não tem as tabelas de documentos, retorna estrutura vazia
      return {
        reseller: null,
        stats: {
          totalCreditsReceived: 0,
          creditsUsed: 0,
          currentBalance: 0,
          totalDocuments: 0,
          totalCnh: 0,
          totalRg: 0,
          totalCarteira: 0
        },
        lastService: null,
        documents: {
          cnhs: [],
          rgs: [],
          carteiras: []
        }
      };
    },
  },

  credits: {
    transfer: async (fromAdminId: number, toAdminId: number, amount: number) => {
      const { data, error } = await supabase.rpc('transfer_credits', {
        p_from_admin_id: fromAdminId,
        p_to_admin_id: toAdminId,
        p_amount: amount
      });

      if (error) throw new Error(error.message);
      return { success: data === true };
    },

    recharge: async (adminId: number, amount: number, unitPrice: number, totalPrice: number) => {
      const { data, error } = await supabase.rpc('recharge_credits', {
        p_admin_id: adminId,
        p_amount: amount,
        p_unit_price: unitPrice,
        p_total_price: totalPrice
      });

      if (error) throw new Error(error.message);
      return { success: data === true };
    },

    getTransactions: async (_adminId?: number) => {
      return [];
    },

    getAllTransactions: async () => {
      return [];
    },

    getBalance: async (adminId: number) => {
      const session = getStoredSession();
      if (!session) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('get_admin_balance', {
        p_admin_id: adminId,
        p_session_token: session.sessionToken
      });

      if (error) throw new Error(error.message);
      return { credits: data || 0 };
    },

    getRevenue: async (_year: number, _month: number) => {
      return { revenue: 0 };
    },

    getMetrics: async () => {
      return {
        totalDeposits: 0,
        totalDepositValue: 0,
        totalTransfers: 0,
        totalTransferCredits: 0,
        avgTicket: 0
      };
    },

    getMonthlyData: async () => {
      return [];
    },

    getMasterMetrics: async (_masterId: number) => {
      return {
        totalTransferred: 0,
        totalTransfers: 0,
        monthTransferred: 0,
        monthTransfers: 0,
        totalRecharged: 0,
        totalSpent: 0,
        monthRecharged: 0,
        monthSpent: 0,
        monthlyGoal: 0,
        totalResellers: 0,
        estimatedRevenue: 0,
        estimatedProfit: 0,
      };
    },

    getMasterTransfers: async (_masterId: number) => {
      return [];
    },

    setMasterGoal: async (_masterId: number, _year: number, _month: number, _targetRevenue: number) => {
      return { success: false };
    },
  },

  payments: {
    createPix: async (credits: number, adminId: number, adminName: string, sessionToken: string) => {
      const { data, error } = await supabase.functions.invoke('create-pix-payment', {
        body: { credits, adminId, adminName, sessionToken }
      });

      if (error) throw new Error(error.message);
      return data;
    },

    checkStatus: async (transactionId: string) => {
      const { data, error } = await supabase.functions.invoke(`check-payment-status/${transactionId}`);

      if (error) throw new Error(error.message);
      return data;
    },

    getHistory: async (_adminId: number) => {
      return [];
    },

    getPriceTiers: async () => {
      const session = getStoredSession();
      if (!session) {
        return [
          { id: 1, min_qty: 50, max_qty: 50, price: 1.40, is_active: true },
          { id: 2, min_qty: 100, max_qty: 100, price: 1.30, is_active: true },
          { id: 3, min_qty: 200, max_qty: 200, price: 1.20, is_active: true },
          { id: 4, min_qty: 300, max_qty: 300, price: 1.10, is_active: true },
          { id: 5, min_qty: 500, max_qty: 500, price: 1.00, is_active: true },
        ];
      }

      const { data, error } = await supabase.rpc('get_price_tiers', {
        p_admin_id: session.adminId,
        p_session_token: session.sessionToken
      });

      if (error || !data || data.length === 0) {
        return [
          { id: 1, min_qty: 50, max_qty: 50, price: 1.40, is_active: true },
          { id: 2, min_qty: 100, max_qty: 100, price: 1.30, is_active: true },
          { id: 3, min_qty: 200, max_qty: 200, price: 1.20, is_active: true },
          { id: 4, min_qty: 300, max_qty: 300, price: 1.10, is_active: true },
          { id: 5, min_qty: 500, max_qty: 500, price: 1.00, is_active: true },
        ];
      }

      return data;
    },

    getGoal: async (_year: number, _month: number) => {
      return { target_revenue: 0, current_revenue: 0 };
    },

    setGoal: async (_year: number, _month: number, _targetRevenue: number) => {
      return { success: false };
    },
  },

  health: async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  },
};

export default supabaseApi;
