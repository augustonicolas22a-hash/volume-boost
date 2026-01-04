import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Navigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { 
  ArrowRightLeft, 
  TrendingUp, 
  Target, 
  Users, 
  CreditCard, 
  DollarSign,
  Calendar,
  Check,
  X,
  Edit2,
  Loader2,
  Wallet,
  ArrowUpRight
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Transfer {
  id: number;
  amount: number;
  created_at: string;
  reseller_name: string;
  reseller_email: string;
}

interface MasterMetrics {
  totalTransferred: number;
  totalTransfers: number;
  monthTransferred: number;
  monthTransfers: number;
  totalRecharged: number;
  totalSpent: number;
  monthRecharged: number;
  monthSpent: number;
  monthlyGoal: number;
  totalResellers: number;
  estimatedRevenue: number;
  estimatedProfit: number;
}

export default function HistoricoTransferencias() {
  const { admin, role, loading } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [metrics, setMetrics] = useState<MasterMetrics | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [editingGoal, setEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');

  useEffect(() => {
    if (admin && role === 'master') {
      fetchData();
    }
  }, [admin, role]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [transfersData, metricsData] = await Promise.all([
        api.credits.getMasterTransfers(admin!.id),
        api.credits.getMasterMetrics(admin!.id),
      ]);
      setTransfers(transfersData || []);
      setMetrics(metricsData);
      setNewGoal((metricsData?.monthlyGoal || 0).toString());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveGoal = async () => {
    const value = parseFloat(newGoal);
    if (isNaN(value) || value <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    try {
      const now = new Date();
      await api.credits.setMasterGoal(admin!.id, now.getFullYear(), now.getMonth() + 1, value);
      setMetrics(prev => prev ? { ...prev, monthlyGoal: value } : null);
      setEditingGoal(false);
      toast.success('Meta atualizada!');
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast.error('Erro ao salvar meta');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  if (role !== 'master') {
    return <Navigate to="/dashboard" replace />;
  }

  const monthProgress = metrics && metrics.monthlyGoal > 0 
    ? Math.min((metrics.monthTransferred / metrics.monthlyGoal) * 100, 100) 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Histórico & Métricas</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Acompanhe suas transferências e desempenho
          </p>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <ArrowRightLeft className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Transferido</p>
                      <p className="text-lg font-bold">{metrics?.totalTransferred.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">{metrics?.totalTransfers} operações</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lucro Estimado</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(metrics?.estimatedProfit || 0)}</p>
                      <p className="text-xs text-muted-foreground">base R$20/crédito</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Wallet className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Recarregado</p>
                      <p className="text-lg font-bold">{metrics?.totalRecharged.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(metrics?.totalSpent || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Users className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Revendedores</p>
                      <p className="text-lg font-bold">{metrics?.totalResellers}</p>
                      <p className="text-xs text-muted-foreground">cadastrados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Goal and Month Stats */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Meta do Mês */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Meta do Mês
                      </CardTitle>
                      <CardDescription>Progresso de transferências</CardDescription>
                    </div>
                    {!editingGoal && (
                      <Button variant="ghost" size="icon" onClick={() => setEditingGoal(true)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingGoal ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Meta em créditos"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="icon" variant="ghost" onClick={handleSaveGoal}>
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingGoal(false)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{monthProgress.toFixed(1)}%</span>
                        </div>
                        <Progress value={monthProgress} className="h-3" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Transferido</p>
                          <p className="text-xl font-bold text-success">
                            {metrics?.monthTransferred.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Meta</p>
                          <p className="text-xl font-bold text-primary">
                            {metrics?.monthlyGoal.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {(metrics?.monthlyGoal || 0) > 0 && (
                        <p className="text-sm text-muted-foreground border-t pt-3">
                          Faltam <span className="font-semibold text-foreground">
                            {Math.max(0, (metrics?.monthlyGoal || 0) - (metrics?.monthTransferred || 0)).toLocaleString('pt-BR')}
                          </span> créditos para a meta
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Resumo do Mês */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Resumo do Mês
                  </CardTitle>
                  <CardDescription>Performance mensal atual</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="h-4 w-4 text-success" />
                        <p className="text-sm text-muted-foreground">Transferências</p>
                      </div>
                      <p className="text-lg font-bold">{metrics?.monthTransfers}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-4 w-4 text-blue-500" />
                        <p className="text-sm text-muted-foreground">Créditos</p>
                      </div>
                      <p className="text-lg font-bold">{metrics?.monthTransferred.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="h-4 w-4 text-purple-500" />
                        <p className="text-sm text-muted-foreground">Recarregado</p>
                      </div>
                      <p className="text-lg font-bold">{metrics?.monthRecharged.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-success" />
                        <p className="text-sm text-muted-foreground">Investido</p>
                      </div>
                      <p className="text-lg font-bold">{formatCurrency(metrics?.monthSpent || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Histórico de Transferências */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  Histórico de Transferências
                </CardTitle>
                <CardDescription>Últimas transferências para revendedores</CardDescription>
              </CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma transferência realizada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Revendedor</TableHead>
                          <TableHead className="text-right">Créditos</TableHead>
                          <TableHead className="text-right">Data</TableHead>
                          <TableHead className="text-right">Hora</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transfers.map((transfer) => (
                          <TableRow key={transfer.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{transfer.reseller_name}</p>
                                <p className="text-xs text-muted-foreground">{transfer.reseller_email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-success">
                              +{transfer.amount.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatDate(transfer.created_at)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatTime(transfer.created_at)}
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
