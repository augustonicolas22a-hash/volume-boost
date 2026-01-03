// Configuração de banco de dados
// Suporta PostgreSQL (Supabase/Cloud) e MySQL nativamente

export type DatabaseType = 'postgres' | 'mysql';

export interface DatabaseConfig {
  type: DatabaseType;
  useSupabase: boolean;
  apiUrl?: string;
}

// Detecta qual banco usar baseado nas variáveis de ambiente
export function getDatabaseConfig(): DatabaseConfig {
  const useMySQL = import.meta.env.VITE_USE_MYSQL === 'true';
  const apiUrl = import.meta.env.VITE_API_URL;

  if (useMySQL && apiUrl) {
    return {
      type: 'mysql',
      useSupabase: false,
      apiUrl
    };
  }

  return {
    type: 'postgres',
    useSupabase: true
  };
}

// Helper para verificar se está usando MySQL
export function isUsingMySQL(): boolean {
  return import.meta.env.VITE_USE_MYSQL === 'true';
}

// Helper para verificar se está usando Supabase/PostgreSQL
export function isUsingSupabase(): boolean {
  return !isUsingMySQL();
}
