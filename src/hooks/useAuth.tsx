import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase
        .from('admins')
        .select('creditos')
        .eq('id', admin.id)
        .single();
      
      if (data && !error) {
        setCredits(data.creditos);
        const updatedAdmin = { ...admin, creditos: data.creditos };
        setAdmin(updatedAdmin);
        localStorage.setItem('admin', JSON.stringify(updatedAdmin));
      }
    }
  };

  const signIn = async (email: string, key: string): Promise<{ error: Error | null; admin?: Admin }> => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id, nome, email, creditos, rank, profile_photo, session_token')
        .eq('email', email.toLowerCase().trim())
        .eq('key', key)
        .single();

      if (error || !data) {
        return { error: new Error('Email ou senha inválidos') };
      }

      const adminData: Admin = {
        id: data.id,
        nome: data.nome,
        email: data.email,
        creditos: data.creditos || 0,
        rank: data.rank || 'revendedor',
        profile_photo: data.profile_photo,
        session_token: data.session_token,
      };

      // Generate session token
      const sessionToken = crypto.randomUUID();
      
      // Update session in database
      await supabase
        .from('admins')
        .update({ 
          session_token: sessionToken,
          last_active: new Date().toISOString()
        })
        .eq('id', adminData.id);

      adminData.session_token = sessionToken;
      
      setAdmin(adminData);
      setRole(adminData.rank as AppRole);
      setCredits(adminData.creditos);
      localStorage.setItem('admin', JSON.stringify(adminData));

      return { error: null, admin: adminData };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signOut = () => {
    if (admin) {
      // Clear session in database
      supabase
        .from('admins')
        .update({ session_token: null })
        .eq('id', admin.id);
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
