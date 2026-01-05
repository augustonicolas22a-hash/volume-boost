import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Crown, Sparkles, TrendingUp, Users, Clock, FileText, IdCard, GraduationCap, Car } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

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

interface DocumentStats {
  totalDocuments: number;
  totalCnh: number;
  totalRg: number;
  totalCarteira: number;
  byReseller: Array<{
    id: number;
    nome: string;
    cnh: number;
    rg: number;
    carteira: number;
    total: number;
  }>;
}

export default function Dashboard() {
  const { admin, role, credits, loading } = useAuth();
  const [topResellers, setTopResellers] = useState<TopReseller[]>([]);
  const [recentResellers, setRecentResellers] = useState<RecentReseller[]>([]);
  const [totalResellers, setTotalResellers] = useState(0);
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!admin) return;
      
      try {
        // Fetch resellers using Node.js API
        const resellers = await api.admins.getResellers(admin.id);
        
        if (resellers) {
          setTotalResellers(resellers.length);
          setRecentResellers(resellers.slice(0, 3).map((r: any) => ({
            id: r.id,
            nome: r.nome,
            created_at: r.created_at || ''
          })));

          // Calculate top resellers from transactions
          try {
            const transactions = await api.credits.getTransactions(admin.id);
            const resellerIds = resellers.map((r: any) => r.id);
            const totals: Record<number, number> = {};
            
            transactions?.forEach((t: any) => {
              if (t.transaction_type === 'transfer' && resellerIds.includes(t.to_admin_id)) {
                totals[t.to_admin_id] = (totals[t.to_admin_id] || 0) + t.amount;
              }
            });

            const topList = Object.entries(totals)
              .map(([id, total]) => ({
                id: parseInt(id),
                nome: resellers.find((r: any) => r.id === parseInt(id))?.nome || 'Desconhecido',
                total_received: total
              }))
              .sort((a, b) => b.total_received - a.total_received)
              .slice(0, 5);

            setTopResellers(topList);
          } catch (error) {
            console.error('Error fetching transactions:', error);
          }
        }

        // Buscar estatísticas de documentos para master
        if (role === 'master') {
          try {
            const docStats = await api.admins.getDocumentStats(admin.id);
            setDocumentStats(docStats);
          } catch (error) {
            console.error('Error fetching document stats:', error);
          }
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
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Olá, {admin.nome}!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Bem-vindo de volta ao seu painel de controle
          </p>
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

        {/* Document Statistics for Master */}
        {role === 'master' && documentStats && (
          <div className="space-y-4">
            {/* Document Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{documentStats.totalDocuments}</p>
                      <p className="text-xs text-muted-foreground">Total Docs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <Car className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{documentStats.totalCnh}</p>
                      <p className="text-xs text-muted-foreground">CNHs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <IdCard className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{documentStats.totalRg}</p>
                      <p className="text-xs text-muted-foreground">RGs</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <GraduationCap className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{documentStats.totalCarteira}</p>
                      <p className="text-xs text-muted-foreground">Carteiras</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents by Reseller */}
            {documentStats.byReseller.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    Documentos por Revendedor
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Quantidade de documentos criados por cada revendedor
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documentStats.byReseller.slice(0, 5).map((reseller, index) => (
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
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <span className="flex items-center gap-1 text-green-500">
                            <Car className="h-3 w-3" />
                            {reseller.cnh}
                          </span>
                          <span className="flex items-center gap-1 text-purple-500">
                            <IdCard className="h-3 w-3" />
                            {reseller.rg}
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <GraduationCap className="h-3 w-3" />
                            {reseller.carteira}
                          </span>
                          <span className="font-semibold text-primary ml-2">
                            = {reseller.total}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
