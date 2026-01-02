import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Tag, Calculator } from 'lucide-react';

const PRICE_TIERS = [
  { minQty: 1, maxQty: 99, price: 14 },
  { minQty: 100, maxQty: 199, price: 13 },
  { minQty: 200, maxQty: 299, price: 12 },
  { minQty: 300, maxQty: 399, price: 11 },
  { minQty: 400, maxQty: 499, price: 10.5 },
  { minQty: 500, maxQty: 999, price: 10 },
  { minQty: 1000, maxQty: Infinity, price: 9.5 },
];

function calculatePrice(quantity: number): { unitPrice: number; total: number } {
  const tier = PRICE_TIERS.find(t => quantity >= t.minQty && quantity <= t.maxQty);
  const unitPrice = tier?.price || 14;
  return { unitPrice, total: quantity * unitPrice };
}

export default function Recarregar() {
  const { user, role, loading, refreshCredits } = useAuth();
  const [quantity, setQuantity] = useState(200);
  const [isProcessing, setIsProcessing] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'master') {
    return <Navigate to="/dashboard" replace />;
  }

  const { unitPrice, total } = calculatePrice(quantity);

  const handleRecharge = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('recharge_credits', {
        _user_id: user.id,
        _amount: quantity,
        _unit_price: unitPrice,
        _total_price: total
      });

      if (error) throw error;

      await refreshCredits();
      toast.success('Recarga realizada com sucesso!', {
        description: `${quantity} créditos adicionados à sua conta`
      });
    } catch (error) {
      toast.error('Erro ao processar recarga');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recarregar Créditos</h1>
          <p className="text-muted-foreground">
            Adicione créditos à sua conta com desconto por volume
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Tabela de Preços
              </CardTitle>
              <CardDescription>
                Quanto maior a quantidade, menor o preço unitário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PRICE_TIERS.map((tier, i) => (
                  <div 
                    key={i}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm">
                      {tier.maxQty === Infinity 
                        ? `${tier.minQty}+ créditos`
                        : `${tier.minQty} - ${tier.maxQty} créditos`
                      }
                    </span>
                    <Badge variant={tier.price <= 10 ? 'default' : 'secondary'}>
                      R$ {tier.price.toFixed(2)}/un
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Calculadora
              </CardTitle>
              <CardDescription>
                Selecione a quantidade desejada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade de Créditos</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="text-lg"
                />
              </div>

              <div className="p-4 rounded-lg gradient-green text-success-foreground space-y-3">
                <div className="flex justify-between">
                  <span className="opacity-90">Preço unitário:</span>
                  <span className="font-bold">R$ {unitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl">
                  <span className="opacity-90">Total:</span>
                  <span className="font-bold">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-lg"
                onClick={handleRecharge}
                disabled={isProcessing || quantity < 1}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {isProcessing ? 'Processando...' : 'Confirmar Recarga'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
