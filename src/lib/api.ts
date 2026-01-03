// Cliente API Unificado - Suporta PostgreSQL (Supabase) e MySQL nativamente
// Configurado via VITE_USE_MYSQL no .env

import { isUsingMySQL } from './db-config';
import { mysqlApi } from './api-mysql';
import { supabaseApi } from './api-supabase';

// Tipo da API
export type ApiClient = typeof mysqlApi | typeof supabaseApi;

// Seleciona automaticamente qual cliente usar baseado na configuração
function getApiClient(): ApiClient {
  if (isUsingMySQL()) {
    console.log('🔧 Usando MySQL (Node.js Backend)');
    return mysqlApi;
  }
  console.log('🔧 Usando PostgreSQL (Supabase/Cloud)');
  return supabaseApi;
}

// Exporta o cliente API selecionado
export const api = getApiClient();

export default api;
