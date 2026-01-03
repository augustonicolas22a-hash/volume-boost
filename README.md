# Data Sistemas

Sistema de gerenciamento de créditos com frontend React e backend Node.js + MySQL.

## 📁 Estrutura do Projeto

```
├── server/              # Backend Node.js + Express + MySQL
│   ├── db/              # Conexão com banco de dados
│   ├── routes/          # Rotas da API
│   ├── index.ts         # Entrada do servidor
│   └── package.json     # Dependências do backend
├── src/                 # Frontend React + Vite + TypeScript
│   ├── components/      # Componentes React
│   ├── hooks/           # Custom hooks
│   ├── pages/           # Páginas da aplicação
│   └── lib/             # Utilitários e cliente API
├── shared/              # Tipos compartilhados
├── docs/                # Documentação e migrations
└── *.bat                # Scripts de automação Windows
```

## 🚀 Instalação

### Requisitos
- Node.js 18+
- MySQL 8+
- npm ou yarn

### Passos

1. **Execute o instalador:**
   ```batch
   install.bat
   ```

2. **Configure o banco de dados:**
   - Edite o arquivo `.env.local` com suas credenciais MySQL
   - Execute `db-push.bat` para criar as tabelas

3. **Inicie o sistema:**
   ```batch
   dev.bat
   ```
   ou
   ```batch
   start.bat
   ```

4. **Acesse:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📦 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `install.bat` | Instala todas as dependências |
| `db-push.bat` | Cria as tabelas no MySQL |
| `dev.bat` | Inicia frontend e backend em modo desenvolvimento |
| `start.bat` | Alias para dev.bat |

## 🔧 Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz com:

```env
# Banco de Dados
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=data_sistemas

# Servidor
PORT=3001
CLIENT_URL=http://localhost:5173
```

### Banco de Dados

O schema completo está em `docs/mysql-migration.sql`. Inclui:
- Tabela `admins` - Usuários do sistema
- Tabela `credit_transactions` - Histórico de transações
- Tabela `pix_payments` - Pagamentos PIX
- Tabela `monthly_goals` - Metas mensais
- Tabela `price_tiers` - Tabela de preços

## 🔒 Segurança

- Senhas armazenadas com hash
- Tokens de sessão únicos
- Validação de PIN
- CORS configurado

## 📡 API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/validate-pin` - Validar PIN
- `POST /api/auth/set-pin` - Definir PIN
- `POST /api/auth/logout` - Logout

### Admins
- `GET /api/admins/:id` - Buscar admin
- `GET /api/admins/resellers/:masterId` - Listar revendedores
- `POST /api/admins/master` - Criar master
- `POST /api/admins/reseller` - Criar revendedor

### Credits
- `POST /api/credits/transfer` - Transferir créditos
- `POST /api/credits/recharge` - Recarregar créditos
- `GET /api/credits/balance/:adminId` - Consultar saldo

### Payments
- `POST /api/payments/pix/create` - Criar pagamento PIX
- `GET /api/payments/pix/status/:id` - Status do pagamento
