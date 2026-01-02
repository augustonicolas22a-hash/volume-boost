import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Loader2, CreditCard } from 'lucide-react';

interface Reseller {
  id: number;
  email: string;
  nome: string;
}

export default function Transferir() {
  const { admin, role, credits, loading, refreshCredits } = useAuth();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [selectedReseller, setSelectedReseller] = useState('');
  const [amount, setAmount] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [loadingResellers, setLoadingResellers] = useState(true);

  useEffect(() => {
    if (admin && role === 'master') {
      fetchResellers();
    }
  }, [admin, role]);

  const fetchResellers = async () => {
    try {
      // Get resellers created by this master
      const { data } = await supabase
        .from('admins')
        .select('id, email, nome')
        .eq('criado_por', admin!.id)
        .eq('rank', 'revendedor');

      setResellers(data || []);
    } catch (error) {
      console.error('Error fetching resellers:', error);
    } finally {
      setLoadingResellers(false);
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

  if (role !== 'master') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleTransfer = async () => {
    if (!selectedReseller || amount <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    if (amount > credits) {
      toast.error('Saldo insuficiente');
      return;
    }

    setIsTransferring(true);

    try {
      const { data, error } = await supabase.rpc('transfer_credits', {
        p_from_admin_id: admin.id,
        p_to_admin_id: parseInt(selectedReseller),
        p_amount: amount
      });

      if (error) throw error;
      if (!data) throw new Error('Saldo insuficiente');

      await refreshCredits();
      toast.success('Transferência realizada com sucesso!', {
        description: `${amount} créditos transferidos`
      });
      
      setAmount(0);
      setSelectedReseller('');
    } catch (error: any) {
      toast.error('Erro na transferência', {
        description: error.message
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transferir Créditos</h1>
          <p className="text-muted-foreground">
            Envie créditos para seus revendedores
          </p>
        </div>

        {/* Balance Card */}
        <Card className="gradient-green text-success-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Seu Saldo Atual</p>
                <p className="text-3xl font-bold">{credits.toLocaleString('pt-BR')}</p>
                <p className="text-sm opacity-80">créditos disponíveis</p>
              </div>
              <CreditCard className="h-12 w-12 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Nova Transferência
            </CardTitle>
            <CardDescription>
              Selecione o revendedor e a quantidade de créditos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingResellers ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : resellers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Você não possui revendedores cadastrados</p>
                <p className="text-sm">Crie um revendedor primeiro</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Revendedor</Label>
                  <Select value={selectedReseller} onValueChange={setSelectedReseller}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um revendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {resellers.map((reseller) => (
                        <SelectItem key={reseller.id} value={reseller.id.toString()}>
                          {reseller.nome || reseller.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Quantidade de Créditos</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={1}
                    max={credits}
                    value={amount || ''}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleTransfer}
                  disabled={isTransferring || !selectedReseller || amount <= 0 || amount > credits}
                >
                  {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Transferir Créditos
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
