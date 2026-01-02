import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Crown, Sparkles, TrendingUp, Users, Clock } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TopReseller {
  id: number;
  nome: string;
  total_received: number;
}

interface RecentReseller {
  id: number;
  nome: string;
  created_at: string;
}

export default function Dashboard() {
  const { admin, role, credits, loading } = useAuth();
  const [topResellers, setTopResellers] = useState<TopReseller[]>([]);
  const [recentResellers, setRecentResellers] = useState<RecentReseller[]>([]);
  const [totalResellers, setTotalResellers] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!admin) return;
      
      try {
        // Fetch resellers created by this admin (for master) or all (for dono)
        const resellersQuery = supabase
          .from('admins')
          .select('id, nome, created_at')
          .eq('rank', 'revendedor');
        
        if (role === 'master') {
          resellersQuery.eq('criado_por', admin.id);
        }
        
        const { data: resellers } = await resellersQuery.order('created_at', { ascending: false });
        
        if (resellers) {
          setTotalResellers(resellers.length);
          setRecentResellers(resellers.slice(0, 3).map(r => ({
            id: r.id,
            nome: r.nome,
            created_at: r.created_at || ''
          })));
        }

        // Fetch top resellers by credits received
        const { data: transactions } = await supabase
          .from('credit_transactions')
          .select('to_admin_id, amount')
          .eq('transaction_type', 'transfer');

        if (transactions && resellers) {
          const resellerIds = resellers.map(r => r.id);
          const totals: Record<number, number> = {};
          
          transactions.forEach(t => {
            if (resellerIds.includes(t.to_admin_id)) {
              totals[t.to_admin_id] = (totals[t.to_admin_id] || 0) + t.amount;
            }
          });

          const topList = Object.entries(totals)
            .map(([id, total]) => ({
              id: parseInt(id),
              nome: resellers.find(r => r.id === parseInt(id))?.nome || 'Desconhecido',
              total_received: total
            }))
            .sort((a, b) => b.total_received - a.total_received)
            .slice(0, 5);

          setTopResellers(topList);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    if (admin && (role === 'master' || role === 'dono')) {
      fetchStats();
    } else {
      setLoadingStats(false);
    }
  }, [admin, role]);

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

  const getRoleBadge = () => {
    switch (role) {
      case 'dono':
        return { label: 'Dono', stars: 3 };
      case 'master':
        return { label: 'Master', stars: 2 };
      case 'revendedor':
        return { label: 'Revendedor', stars: 1 };
      default:
        return { label: 'Usuário', stars: 0 };
    }
  };

  const roleBadge = getRoleBadge();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data não disponível';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Olá, {admin.nome}!
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Bem-vindo de volta ao seu painel de controle
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm">Pronto para criar</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatsCard
            title="Créditos Disponíveis"
            value={credits.toLocaleString('pt-BR')}
            subtitle="Créditos ativos"
            variant="green"
            icon={<CreditCard className="h-6 w-6 sm:h-8 sm:w-8" />}
          />
          <StatsCard
            title="Seu Status"
            value={`${roleBadge.label} ${'★'.repeat(roleBadge.stars)}`}
            subtitle="Nível de acesso premium"
            variant="pink"
            icon={<Crown className="h-6 w-6 sm:h-8 sm:w-8" />}
          />
          {(role === 'master' || role === 'dono') && (
            <StatsCard
              title="Total de Revendas"
              value={totalResellers}
              subtitle="Revendedores ativos"
              variant="blue"
              icon={<Users className="h-6 w-6 sm:h-8 sm:w-8" />}
            />
          )}
        </div>

        {/* Statistics Grid */}
        {(role === 'master' || role === 'dono') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Top Resellers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Top Revendedores
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Revendedores que mais receberam créditos
                </p>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : topResellers.length > 0 ? (
                  <div className="space-y-3">
                    {topResellers.map((reseller, index) => (
                      <div 
                        key={reseller.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`
                            w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                            ${index === 0 ? 'bg-yellow-500 text-yellow-950' : 
                              index === 1 ? 'bg-gray-400 text-gray-950' : 
                              index === 2 ? 'bg-amber-600 text-amber-950' : 
                              'bg-muted text-muted-foreground'}
                          `}>
                            {index + 1}
                          </span>
                          <span className="font-medium text-sm sm:text-base">{reseller.nome}</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          {reseller.total_received.toLocaleString('pt-BR')} créditos
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhuma transferência realizada ainda
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Resellers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="h-5 w-5 text-primary" />
                  Últimos Criados
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Revendedores criados recentemente
                </p>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : recentResellers.length > 0 ? (
                  <div className="space-y-3">
                    {recentResellers.map((reseller) => (
                      <div 
                        key={reseller.id} 
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-muted/50 gap-1 sm:gap-0"
                      >
                        <span className="font-medium text-sm sm:text-base">{reseller.nome}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {formatDate(reseller.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhum revendedor criado ainda
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Updates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Últimas Atualizações
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Fique por dentro das novidades do sistema
            </p>
          </CardHeader>
          <CardContent>
            <div className="border-l-4 border-primary pl-4 py-2">
              <h4 className="font-medium">Sistema de créditos ativo!</h4>
              <p className="text-sm text-muted-foreground">
                O novo sistema de créditos está funcionando. Masters podem recarregar e transferir para seus revendedores.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                📅 02/01/2026
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
