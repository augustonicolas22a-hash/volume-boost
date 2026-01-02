import { useState, useEffect, useRef } from 'react';
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
import ReactCanvasConfetti from 'react-canvas-confetti';

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
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixData, setPixData] = useState<PixPayment | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentExpired, setPaymentExpired] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutos

  // Confetti ref
  const refAnimationInstance = useRef<any>(null);

  const getInstance = (instance: any) => {
    refAnimationInstance.current = instance;
  };

  const makeShot = (particleRatio: number, opts: any) => {
    refAnimationInstance.current &&
      refAnimationInstance.current({
        ...opts,
        origin: { y: 0.7 },
        particleCount: Math.floor(200 * particleRatio),
      });
  };

  const fire = () => {
    makeShot(0.25, { spread: 26, startVelocity: 55 });
    makeShot(0.2, { spread: 60 });
    makeShot(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    makeShot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    makeShot(0.1, { spread: 120, startVelocity: 45 });
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Erro ao tocar som:', error);
    }
  };

  // Timer countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (showPixModal && !paymentConfirmed && !paymentExpired && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setPaymentExpired(true);
            setCheckingPayment(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showPixModal, paymentConfirmed, paymentExpired, timeRemaining]);

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
      if (response.data?.error) throw new Error(response.data.details || response.data.error);

      const pixPayment = response.data;
      setPixData(pixPayment);
      setShowPixModal(true);
      setPaymentConfirmed(false);
      setPaymentExpired(false);
      setTimeRemaining(600);
      setCheckingPayment(true);

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
        // Query directly from database for faster response
        const { data: payment } = await supabase
          .from('pix_payments')
          .select('status, credits')
          .eq('transaction_id', transactionId)
          .single();

        if (payment?.status === 'PAID') {
          setPaymentConfirmed(true);
          setCheckingPayment(false);
          
          // Play sound and fire confetti
          playNotificationSound();
          fire();
          
          // Update credits
          await refreshCredits();
          
          toast.success('Pagamento confirmado!', {
            description: `${payment.credits} créditos adicionados à sua conta`
          });

          // Close modal after 3 seconds
          setTimeout(() => {
            setShowPixModal(false);
            setPixData(null);
          }, 3000);
          return;
        }
      } catch (error) {
        console.log('Erro ao verificar pagamento:', error);
      }

      // Continue checking if not paid yet
      if (!paymentConfirmed && !paymentExpired) {
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

      <Dialog open={showPixModal} onOpenChange={(open) => {
        if (!open) {
          setCheckingPayment(false);
        }
        setShowPixModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento PIX</DialogTitle>
          </DialogHeader>
          
          {!paymentConfirmed && !paymentExpired && (
            <div className="space-y-4">
              {/* Timer */}
              <div className="text-center">
                <div className={`text-3xl font-bold ${timeRemaining < 60 ? 'text-red-600' : 'text-orange-600'}`}>
                  <Clock className="inline-block mr-2 h-6 w-6" />
                  {formatTime(timeRemaining)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Tempo restante para pagamento</p>
              </div>

              {/* QR Code */}
              {pixData?.qrCodeBase64 && (
                <div className="text-center">
                  <img 
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
                    alt="QR Code PIX" 
                    className="mx-auto max-w-[200px] border rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Escaneie o QR Code com seu app de banco
                  </p>
                </div>
              )}

              {/* PIX Code */}
              <div className="space-y-2">
                <Label>Código PIX (Copia e Cola):</Label>
                <div className="flex gap-2">
                  <Input value={pixData?.qrCode || ""} readOnly className="text-xs" />
                  <Button onClick={copyPixCode} size="sm">Copiar</Button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Como pagar:</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Abra o app do seu banco</li>
                  <li>Escaneie o QR Code ou cole o código PIX</li>
                  <li>Confirme o pagamento</li>
                  <li>Aguarde a confirmação automática</li>
                </ol>
              </div>

              {/* Verification status */}
              {checkingPayment && (
                <div className="text-center py-2">
                  <div className="flex items-center justify-center space-x-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Verificando pagamento...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentConfirmed && (
            <div className="text-center py-6">
              <div className="bg-green-50 dark:bg-green-950/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">Pagamento Confirmado!</h3>
                <p className="text-green-600 dark:text-green-400">{quantity} créditos adicionados à sua conta</p>
              </div>
            </div>
          )}

          {paymentExpired && (
            <div className="text-center py-6">
              <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Pagamento Expirado</h3>
                <p className="text-red-600 dark:text-red-400 mb-4">O tempo para pagamento expirou</p>
                <Button onClick={() => { 
                  setShowPixModal(false); 
                  setPaymentExpired(false);
                  setPixData(null);
                }}>
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confetti Canvas */}
      <ReactCanvasConfetti
        onInit={getInstance}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 9999,
        }}
      />
    </DashboardLayout>
  );
}
