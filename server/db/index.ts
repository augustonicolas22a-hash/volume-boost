import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Carrega variáveis de ambiente ANTES de criar o pool
// Prioridade: .env.local > .env (na raiz do projeto ou na pasta server)
const envFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env.local'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    console.log(`[DB] Carregando env de: ${envPath}`);
    break;
  }
}

// Mostrar qual banco será usado
console.log(`[DB] Conectando em: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'} / ${process.env.DB_NAME || 'teste'}`);

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'ventura',
  password: process.env.DB_PASSWORD || 'Al061176aa!@@',
  database: process.env.DB_NAME || 'teste',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export async function getConnection() {
  return pool.getConnection();
}
