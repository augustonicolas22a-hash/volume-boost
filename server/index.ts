import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { pool } from './db';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admins';
import creditRoutes from './routes/credits';
import paymentRoutes from './routes/payments';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Banner do sistema
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                    DATA SISTEMAS - BACKEND                   ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║  Sistema de Gerenciamento de Créditos                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('\n');

// Função para testar conexão com MySQL
async function testDatabaseConnection() {
  console.log('📊 CONFIGURAÇÃO DO BANCO DE DADOS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`   Tipo: MySQL / MariaDB`);
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Porta: ${process.env.DB_PORT || '3306'}`);
  console.log(`   Banco: ${process.env.DB_NAME || 'data_sistemas'}`);
  console.log(`   Usuário: ${process.env.DB_USER || 'root'}`);
  console.log('─────────────────────────────────────────────────────────────────');
  
  try {
    const connection = await pool.getConnection();
    
    // Testar query simples
    const [rows] = await connection.execute('SELECT 1 as test');
    
    // Verificar tabela admins
    const [admins] = await connection.execute('SELECT COUNT(*) as total FROM admins');
    const totalAdmins = (admins as any[])[0]?.total || 0;
    
    // Verificar se tem dono cadastrado
    const [donos] = await connection.execute("SELECT COUNT(*) as total FROM admins WHERE `rank` = 'dono'");
    const totalDonos = (donos as any[])[0]?.total || 0;
    
    connection.release();
    
    console.log('\n✅ CONEXÃO COM MYSQL: SUCESSO');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`   Total de admins cadastrados: ${totalAdmins}`);
    console.log(`   Donos do sistema: ${totalDonos}`);
    
    if (totalDonos === 0) {
      console.log('\n⚠️  ATENÇÃO: Nenhum usuário "dono" encontrado!');
      console.log('   Execute o SQL em docs/database.sql para criar o admin padrão.');
    }
    
    console.log('─────────────────────────────────────────────────────────────────');
    return true;
  } catch (error: any) {
    console.log('\n❌ CONEXÃO COM MYSQL: FALHOU');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`   Erro: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 SOLUÇÃO: O MySQL não está rodando ou a porta está errada.');
      console.log('   - Inicie o MySQL/XAMPP/MariaDB');
      console.log('   - Verifique a porta no .env.local');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 SOLUÇÃO: Usuário ou senha incorretos.');
      console.log('   - Verifique DB_USER e DB_PASSWORD no .env.local');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 SOLUÇÃO: Banco de dados não existe.');
      console.log(`   - Crie o banco "${process.env.DB_NAME}" no MySQL`);
      console.log('   - Execute o SQL em docs/database.sql');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\n💡 SOLUÇÃO: Tabela não encontrada.');
      console.log('   - Execute o SQL em docs/database.sql');
    }
    
    console.log('─────────────────────────────────────────────────────────────────');
    return false;
  }
}

// CORS (dev-friendly): aceita múltiplas origens locais (5173/8080/127.0.0.1)
const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ].filter(Boolean) as string[]
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests sem Origin (ex: curl/postman) devem ser permitidos
      if (!origin) return callback(null, true);

      if (allowedOrigins.has(origin)) return callback(null, true);

      return callback(
        new Error(
          `CORS bloqueado: origem ${origin} não permitida. Configure CLIENT_URL ou use localhost:5173/8080.`
        )
      );
    },
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    res.json({ 
      status: 'ok', 
      database: 'mysql',
      connected: true,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.json({ 
      status: 'error', 
      database: 'mysql',
      connected: false,
      timestamp: new Date().toISOString() 
    });
  }
});

// Iniciar servidor
async function startServer() {
  const dbConnected = await testDatabaseConnection();
  
  app.listen(PORT, () => {
    console.log('\n🚀 SERVIDOR INICIADO');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   CORS (origens permitidas): ${Array.from(allowedOrigins).join(', ') || 'nenhuma'}`);
    console.log('─────────────────────────────────────────────────────────────────');
    
    if (dbConnected) {
      console.log('\n✅ Sistema pronto para uso!');
    } else {
      console.log('\n⚠️  Sistema iniciado, mas sem conexão com banco de dados.');
      console.log('   Corrija as configurações e reinicie o servidor.');
    }
    
    console.log('\n📝 Pressione Ctrl+C para parar o servidor.\n');
  });
}

startServer();
