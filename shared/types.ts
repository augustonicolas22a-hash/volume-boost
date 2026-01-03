// Tipos compartilhados entre cliente e servidor

export interface Admin {
  id: number;
  nome: string;
  email: string;
  creditos: number;
  rank: 'administrador' | 'master' | 'revendedor';
  profile_photo?: string;
  pin?: string;
  session_token?: string;
  criado_por?: number;
  created_at?: string;
  last_active?: string;
}

export interface CreditTransaction {
  id: number;
  from_admin_id?: number;
  to_admin_id: number;
  amount: number;
  unit_price?: number;
  total_price?: number;
  transaction_type: 'recharge' | 'transfer';
  created_at: string;
  from_admin_name?: string;
  to_admin_name?: string;
}

export interface PixPayment {
  id: number;
  admin_id: number;
  admin_name: string;
  credits: number;
  amount: number;
  transaction_id: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  created_at: string;
  paid_at?: string;
}

export interface PriceTier {
  id: number;
  min_qty: number;
  max_qty?: number;
  price: number;
  is_active: boolean;
}

export interface MonthlyGoal {
  id: number;
  year: number;
  month: number;
  target_revenue: number;
}

export interface LoginRequest {
  email: string;
  key: string;
}

export interface LoginResponse {
  admin: Admin;
}

export interface TransferRequest {
  fromAdminId: number;
  toAdminId: number;
  amount: number;
}

export interface DashboardStats {
  totalMasters: number;
  totalResellers: number;
  totalCredits: number;
}
