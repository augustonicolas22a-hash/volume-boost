import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Tag, Calculator, QrCode, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';

const PRICE_TIERS = [
  { minQty: 1, maxQty: 9, price: 1 }, // Preço de teste - R$1 por crédito
  { minQty: 10, maxQty: 99, price: 14 },
  { minQty: 100, maxQty: 199, price: 13 },
  { minQty: 200, maxQty: 299, price: 12 },
  { minQty: 300, maxQty: 399, price: 11 },
  { minQty: 400, maxQty: 499, price: 10.5 },
  { minQty: 500, maxQty: 999, price: 10 },
  { minQty: 1000, maxQty: Infinity, price: 9.5 },
];

interface PixPayment {
  transactionId: string;
  qrCode: string;
  qrCodeBase64: string;
}

function calculatePrice(quantity: number): { unitPrice: number; total: number } {
  const tier = PRICE_TIERS.find(t => quantity >= t.minQty && quantity <= t.maxQty);
  const unitPrice = tier?.price || 14;
  return { unitPrice, total: quantity * unitPrice };
}

export default function Recarregar() {
  const { admin, role, loading, refreshCredits } = useAuth();
  const [quantity, setQuantity] = useState(200);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixData, setPixData] = useState<PixPayment | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentExpired, setPaymentExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600);

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

  const { unitPrice, total } = calculatePrice(quantity);

  const handleRecharge = async () => {
    setIsProcessing(true);
    try {
      const response = await supabase.functions.invoke('create-pix-payment', {
        body: {
          amount: total,
          credits: quantity,
          adminId: admin.id,
          adminName: admin.nome,
        }
      });

      if (response.error) throw response.error;

      const pixPayment = response.data;
      setPixData(pixPayment);
      setShowPixModal(true);
      setPaymentConfirmed(false);
      setPaymentExpired(false);
      setTimeRemaining(600);

      // Start payment verification
      startPaymentVerification(pixPayment.transactionId);

      toast.success('PIX Gerado!', {
        description: `PIX de R$ ${total.toFixed(2)} criado com sucesso`
      });
    } catch (error: any) {
      toast.error('Erro ao gerar PIX', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const startPaymentVerification = (transactionId: string) => {
    const checkPayment = async () => {
      try {
        const response = await supabase.functions.invoke('check-payment-status', {
          body: { transactionId }
        });

        if (response.data?.status === 'PAID') {
          setPaymentConfirmed(true);
          await refreshCredits();
          toast.success('Pagamento confirmado!', {
            description: `${quantity} créditos adicionados à sua conta`
          });
          setTimeout(() => {
            setShowPixModal(false);
            setPixData(null);
          }, 3000);
          return;
        }
      } catch (error) {
        console.log('Erro ao verificar pagamento:', error);
      }

      if (!paymentConfirmed && !paymentExpired && timeRemaining > 0) {
        setTimeout(checkPayment, 3000);
      }
    };

    checkPayment();
  };

  const copyPixCode = () => {
    if (pixData?.qrCode) {
      navigator.clipboard.writeText(pixData.qrCode);
      toast.success('Código copiado!');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recarregar Créditos</h1>
          <p className="text-muted-foreground">
            Adicione créditos via PIX com desconto por volume
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Tabela de Preços
              </CardTitle>
              <CardDescription>Quanto maior a quantidade, menor o preço</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {PRICE_TIERS.map((tier, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">
                      {tier.maxQty === Infinity ? `${tier.minQty}+ créditos` : `${tier.minQty} - ${tier.maxQty} créditos`}
                    </span>
                    <Badge variant={tier.price <= 10 ? 'default' : 'secondary'}>
                      R$ {tier.price.toFixed(2)}/un
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Calculadora
              </CardTitle>
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
                  <span>Preço unitário:</span>
                  <span className="font-bold">R$ {unitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl">
                  <span>Total:</span>
                  <span className="font-bold">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <Button className="w-full h-12 text-lg" onClick={handleRecharge} disabled={isProcessing || quantity < 1}>
                {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
                {isProcessing ? 'Gerando PIX...' : 'Gerar PIX'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento PIX</DialogTitle>
          </DialogHeader>
          
          {!paymentConfirmed && !paymentExpired && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatTime(timeRemaining)}</div>
                <p className="text-sm text-muted-foreground">Tempo restante</p>
              </div>

              {pixData?.qrCodeBase64 && (
                <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto max-w-[200px] border rounded-lg" />
              )}

              <div className="space-y-2">
                <Label>Código PIX:</Label>
                <div className="flex gap-2">
                  <Input value={pixData?.qrCode || ""} readOnly className="text-xs" />
                  <Button onClick={copyPixCode} size="sm">Copiar</Button>
                </div>
              </div>
            </div>
          )}

          {paymentConfirmed && (
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700">Pagamento Confirmado!</h3>
              <p className="text-green-600">{quantity} créditos adicionados</p>
            </div>
          )}

          {paymentExpired && (
            <div className="text-center py-6">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-700">Pagamento Expirado</h3>
              <Button onClick={() => { setShowPixModal(false); setPaymentExpired(false); }}>Tentar Novamente</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
