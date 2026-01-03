import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import api from '@/lib/api';

type AppRole = 'dono' | 'master' | 'revendedor' | null;

interface Admin {
  id: number;
  nome: string;
  email: string;
  creditos: number;
  rank: string;
  profile_photo: string | null;
  session_token: string | null;
}

interface AuthContextType {
  admin: Admin | null;
  role: AppRole;
  credits: number;
  loading: boolean;
  signIn: (email: string, key: string) => Promise<{ error: Error | null; admin?: Admin }>;
  signOut: () => void;
  refreshCredits: () => Promise<void>;
  updateAdmin: (admin: Admin) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored admin on mount
    const storedAdmin = localStorage.getItem('admin');
    if (storedAdmin) {
      try {
        const parsedAdmin = JSON.parse(storedAdmin) as Admin;
        setAdmin(parsedAdmin);
        setRole(parsedAdmin.rank as AppRole);
        setCredits(parsedAdmin.creditos);
      } catch (e) {
        localStorage.removeItem('admin');
      }
    }
    setLoading(false);
  }, []);

  const refreshCredits = async () => {
    if (admin) {
      try {
        const data = await api.credits.getBalance(admin.id);
        if (data) {
          setCredits(data.credits);
          const updatedAdmin = { ...admin, creditos: data.credits };
          setAdmin(updatedAdmin);
          localStorage.setItem('admin', JSON.stringify(updatedAdmin));
        }
      } catch (error) {
        console.error('Error refreshing credits:', error);
      }
    }
  };

  const signIn = async (email: string, key: string): Promise<{ error: Error | null; admin?: Admin }> => {
    try {
      const data = await api.auth.login(email, key);

      if (!data?.admin) {
        return { error: new Error('Email ou senha inválidos') };
      }

      const adminData: Admin = {
        id: data.admin.id,
        nome: data.admin.nome,
        email: data.admin.email,
        creditos: data.admin.creditos || 0,
        rank: data.admin.rank || 'revendedor',
        profile_photo: data.admin.profile_photo,
        session_token: data.admin.session_token,
      };
      
      setAdmin(adminData);
      setRole(adminData.rank as AppRole);
      setCredits(adminData.creditos);
      localStorage.setItem('admin', JSON.stringify(adminData));

      return { error: null, admin: adminData };
    } catch (e: any) {
      return { error: new Error(e.message || 'Erro ao fazer login') };
    }
  };

  const signOut = async () => {
    if (admin) {
      try {
        await api.auth.logout(admin.id);
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
    
    setAdmin(null);
    setRole(null);
    setCredits(0);
    localStorage.removeItem('admin');
  };

  const updateAdmin = (updatedAdmin: Admin) => {
    setAdmin(updatedAdmin);
    setRole(updatedAdmin.rank as AppRole);
    setCredits(updatedAdmin.creditos);
    localStorage.setItem('admin', JSON.stringify(updatedAdmin));
  };

  return (
    <AuthContext.Provider value={{ admin, role, credits, loading, signIn, signOut, refreshCredits, updateAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
