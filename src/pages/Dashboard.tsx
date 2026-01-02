import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Crown, Sparkles } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { admin, role, credits, loading } = useAuth();

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

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Olá, {admin.nome}!
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo de volta ao seu painel de controle
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            <span>Pronto para criar</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatsCard
            title="Créditos Disponíveis"
            value={credits.toLocaleString('pt-BR')}
            subtitle="Créditos ativos"
            variant="green"
            icon={<CreditCard className="h-8 w-8" />}
          />
          <StatsCard
            title="Seu Status"
            value={`${roleBadge.label} ${'★'.repeat(roleBadge.stars)}`}
            subtitle="Nível de acesso premium"
            variant="pink"
            icon={<Crown className="h-8 w-8" />}
          />
        </div>

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
