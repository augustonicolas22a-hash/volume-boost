import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { UserSearch } from '@/components/dashboard/UserSearch';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { GoalProgress } from '@/components/dashboard/GoalProgress';
import { TopMasters } from '@/components/dashboard/TopMasters';
import { DepositTransferMetrics } from '@/components/dashboard/DepositTransferMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import api from '@/lib/api';
import { BarChart3, Users, CreditCard, TrendingUp, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface Stats {
  totalMasters: number;
  totalResellers: number;
  totalCredits: number;
  totalTransactions: number;
}

interface Transaction {
  id: number;
  amount: number;
  transaction_type: string;
  total_price: number | null;
  created_at: string;
  from_admin_id: number | null;
  to_admin_id: number;
  from_admin_name?: string;
  to_admin_name?: string;
}

export default function Estatisticas() {
  const { admin, role, loading } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMasters: 0,
    totalResellers: 0,
    totalCredits: 0,
    totalTransactions: 0
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (admin && role === 'dono') {
      fetchStats();
    }
  }, [admin, role]);

  const fetchStats = async () => {
    try {
      // Get dashboard stats from Node.js API
      const dashboardStats = await api.admins.getDashboardStats();
      
      // Get transactions - for now we'll skip this as it requires a new endpoint
      // We can add it later to the Node.js API
      
      setStats({
        totalMasters: dashboardStats.totalMasters || 0,
        totalResellers: dashboardStats.totalResellers || 0,
        totalCredits: dashboardStats.totalCredits || 0,
        totalTransactions: 0 // Will need to add this to the API
      });

      setTransactions([]);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'dono') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estatísticas</h1>
          <p className="text-muted-foreground">
            Visão geral completa do sistema
          </p>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total Masters"
                value={stats.totalMasters}
                subtitle="Contas ativas"
                variant="blue"
                icon={<Users className="h-8 w-8" />}
              />
              <StatsCard
                title="Total Revendedores"
                value={stats.totalResellers}
                subtitle="Contas ativas"
                variant="pink"
                icon={<Users className="h-8 w-8" />}
              />
              <StatsCard
                title="Créditos no Sistema"
                value={stats.totalCredits.toLocaleString('pt-BR')}
                subtitle="Créditos circulando"
                variant="green"
                icon={<CreditCard className="h-8 w-8" />}
              />
              <StatsCard
                title="Total Transações"
                value={stats.totalTransactions}
                subtitle="Operações realizadas"
                icon={<TrendingUp className="h-8 w-8" />}
              />
            </div>

            {/* Deposit/Transfer Metrics */}
            <DepositTransferMetrics />

            {/* User Search */}
            <UserSearch />

            {/* Charts and Goals Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart />
              <div className="space-y-6">
                <GoalProgress />
                <TopMasters />
              </div>
            </div>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Últimas Transações
                </CardTitle>
                <CardDescription>
                  As 10 transações mais recentes do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma transação registrada
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>De</TableHead>
                          <TableHead>Para</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <Badge variant={tx.transaction_type === 'recharge' ? 'default' : 'secondary'}>
                                {tx.transaction_type === 'recharge' ? (
                                  <>
                                    <ArrowDownRight className="h-3 w-3 mr-1" />
                                    Recarga
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpRight className="h-3 w-3 mr-1" />
                                    Transferência
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {tx.from_admin_name || (tx.transaction_type === 'recharge' ? 'Sistema' : '-')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {tx.to_admin_name || '-'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {tx.amount.toLocaleString('pt-BR')} créditos
                            </TableCell>
                            <TableCell>
                              {tx.total_price 
                                ? `R$ ${tx.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(tx.created_at).toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
