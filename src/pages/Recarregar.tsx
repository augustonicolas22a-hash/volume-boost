import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { Navigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { CreditCard, Tag, QrCode, Loader2, Clock, CheckCircle, XCircle, History, RefreshCw, TrendingDown, Bitcoin, Star, Crown, Gem, Info } from 'lucide-react';
import ReactCanvasConfetti from 'react-canvas-confetti';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Fixed credit packages - NO custom input allowed
// Base price is R$14, discounts increase with quantity

// Section 1: Pacotes Populares (mais vendidos)
const POPULAR_PACKAGES = [
  { credits: 5, unitPrice: 14.00, total: 70 },
  { credits: 10, unitPrice: 14.00, total: 140 },
  { credits: 25, unitPrice: 13.50, total: 337.50 },
  { credits: 50, unitPrice: 13.00, total: 650 },
];

// Section 2: Pacotes Intermediários
const INTERMEDIATE_PACKAGES = [
  { credits: 75, unitPrice: 12.50, total: 937.50 },
  { credits: 100, unitPrice: 12.00, total: 1200 },
  { credits: 150, unitPrice: 11.50, total: 1725 },
  { credits: 200, unitPrice: 10.00, total: 2000 },
];

// Section 3: Grandes Volumes
const LARGE_PACKAGES = [
  { credits: 250, unitPrice: 9.50, total: 2375 },
  { credits: 300, unitPrice: 9.00, total: 2700 },
  { credits: 400, unitPrice: 8.50, total: 3400 },
  { credits: 500, unitPrice: 8.00, total: 4000 },
  { credits: 1000, unitPrice: 7.00, total: 7000 },
];

// All packages combined for slider functionality
const CREDIT_PACKAGES = [...POPULAR_PACKAGES, ...INTERMEDIATE_PACKAGES, ...LARGE_PACKAGES].map((pkg, i) => ({
  ...pkg,
  popular: [50, 100, 200].includes(pkg.credits),
}));

const BASE_PRICE = 14; // Price without discount

type CreditPackage = { credits: number; unitPrice: number; total: number; popular?: boolean };

function calculateSavings(pkg: CreditPackage) {
  const fullPrice = pkg.credits * BASE_PRICE;
  const savings = fullPrice - pkg.total;
  const percentOff = ((savings / fullPrice) * 100).toFixed(0);
  return { savings, percentOff };
}

// Get package index from slider value
function getPackageFromSlider(value: number): CreditPackage {
  return CREDIT_PACKAGES[Math.min(value, CREDIT_PACKAGES.length - 1)];
}

interface PixPayment {
  transactionId: string;
  qrCode: string;
  qrCodeBase64: string;
}

interface PaymentHistory {
  id: number;
  amount: number;
  credits: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

export default function Recarregar() {
  const { admin, role, credits, loading, updateAdmin } = useAuth();
  const [sliderValue, setSliderValue] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage>(CREDIT_PACKAGES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixData, setPixData] = useState<PixPayment | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentExpired, setPaymentExpired] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const hasPlayedSound = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refAnimationInstance = useRef<any>(null);

  const handleInit = useCallback(({ confetti }: { confetti: any }) => {
    refAnimationInstance.current = confetti;
  }, []);

  const fire = useCallback(() => {
    if (!refAnimationInstance.current) return;
    
    const makeShot = (particleRatio: number, opts: any) => {
      refAnimationInstance.current({
        ...opts,
        origin: { y: 0.7 },
        particleCount: Math.floor(200 * particleRatio),
      });
    };

    makeShot(0.25, { spread: 26, startVelocity: 55 });
    makeShot(0.2, { spread: 60 });
    makeShot(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    makeShot(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    makeShot(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  const playNotificationSound = useCallback(() => {
    if (hasPlayedSound.current) return;
    hasPlayedSound.current = true;
    
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
  }, []);

  const fetchPaymentHistory = useCallback(async () => {
    if (!admin) return;
    
    try {
      const data = await api.payments.getHistory(admin.id);
      setPaymentHistory(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [admin]);

  useEffect(() => {
    if (admin) {
      fetchPaymentHistory();
    }
  }, [admin, fetchPaymentHistory]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (showPixModal && !paymentConfirmed && !paymentExpired && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setPaymentExpired(true);
            setCheckingPayment(false);
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
            }
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

  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

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

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0];
    setSliderValue(newValue);
    setSelectedPackage(getPackageFromSlider(newValue));
  };

  const handleSelectPackage = (pkg: typeof CREDIT_PACKAGES[0], index: number) => {
    setSliderValue(index);
    setSelectedPackage(pkg);
  };

  const handleRecharge = async () => {
    if (!selectedPackage || !admin?.session_token) {
      toast.error('Selecione um pacote de créditos');
      return;
    }

    setIsProcessing(true);
    hasPlayedSound.current = false;
    
    try {
      const pixPayment = await api.payments.createPix(
        selectedPackage.credits,
        admin.id,
        admin.nome,
        admin.session_token
      );

      if (pixPayment.error) throw new Error(pixPayment.details || pixPayment.error);

      setPixData(pixPayment);
      setShowPixModal(true);
      setPaymentConfirmed(false);
      setPaymentExpired(false);
      setTimeRemaining(600);
      setCheckingPayment(true);

      startPaymentVerification(pixPayment.transactionId);

      toast.success('PIX Gerado!', {
        description: `PIX de R$ ${selectedPackage.total.toFixed(2)} criado com sucesso`
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
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }

    const checkPayment = async () => {
      try {
        const payment = await api.payments.checkStatus(transactionId);

        if (payment?.status === 'PAID') {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          
          setPaymentConfirmed(true);
          setCheckingPayment(false);
          
          playNotificationSound();
          fire();
          
          // Atualizar créditos do admin
          const balanceData = await api.credits.getBalance(admin.id);
          if (balanceData) {
            updateAdmin({ ...admin, creditos: balanceData.credits });
          }
          
          fetchPaymentHistory();
          
          toast.success('Pagamento confirmado!', {
            description: `${payment.credits} créditos adicionados à sua conta`
          });

          setTimeout(() => {
            setShowPixModal(false);
            setPixData(null);
            setSelectedPackage(CREDIT_PACKAGES[0]);
          }, 3000);
          return;
        }
      } catch (error) {
        console.log('Erro ao verificar pagamento:', error);
      }
    };

    checkPayment();
    checkIntervalRef.current = setInterval(checkPayment, 3000);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>;
      case 'PENDING':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Recarregar Créditos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Escolha um pacote de créditos para recarregar via PIX
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-muted-foreground">Saldo atual</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{credits} créditos</p>
          </div>
        </div>

        {/* Credit Packages */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Tag className="h-5 w-5 text-primary" />
              Pacotes de Créditos
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Selecione um pacote para recarregar
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-6">
            {/* Package Cards Grid */}
            {/* Section 1: Pacotes Populares */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-primary fill-primary" />
                <h3 className="font-semibold text-foreground">Pacotes Populares</h3>
                <Badge variant="secondary" className="text-[10px]">Mais vendidos</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <TooltipProvider>
                  {POPULAR_PACKAGES.map((pkg) => {
                    const { savings, percentOff } = calculateSavings(pkg);
                    const index = CREDIT_PACKAGES.findIndex(p => p.credits === pkg.credits);
                    return (
                      <Tooltip key={pkg.credits}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleSelectPackage({ ...pkg, popular: false }, index)}
                            className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                              selectedPackage.credits === pkg.credits
                                ? 'border-primary bg-primary/10'
                                : 'border-primary/30 bg-primary/5 hover:border-primary'
                            }`}
                          >
                            {savings > 0 && (
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                -{percentOff}%
                              </div>
                            )}
                            <div className="text-xl font-bold text-foreground">{pkg.credits}</div>
                            <div className="text-xs text-muted-foreground">créditos</div>
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                R$ {pkg.unitPrice.toFixed(2)}/un
                              </Badge>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-primary">
                              R$ {pkg.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-sm space-y-1">
                            <p className="font-semibold">{pkg.credits} créditos</p>
                            <p className="text-muted-foreground">Preço por unidade: R$ {pkg.unitPrice.toFixed(2)}</p>
                            {savings > 0 && (
                              <>
                                <p className="text-green-500">Economia: R$ {savings.toFixed(2)}</p>
                                <p className="text-green-500 font-medium">{percentOff}% de desconto!</p>
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>

            {/* Section 2: Pacotes Intermediários */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-foreground">Pacotes Intermediários</h3>
                <Badge variant="outline" className="text-[10px] text-green-600 border-green-500">Melhor custo-benefício</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <TooltipProvider>
                  {INTERMEDIATE_PACKAGES.map((pkg) => {
                    const { savings, percentOff } = calculateSavings(pkg);
                    const index = CREDIT_PACKAGES.findIndex(p => p.credits === pkg.credits);
                    return (
                      <Tooltip key={pkg.credits}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleSelectPackage({ ...pkg, popular: false }, index)}
                            className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                              selectedPackage.credits === pkg.credits
                                ? 'border-primary bg-primary/10'
                                : 'border-muted hover:border-primary/50'
                            }`}
                          >
                            {savings > 0 && (
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                -{percentOff}%
                              </div>
                            )}
                            <div className="text-xl font-bold text-foreground">{pkg.credits}</div>
                            <div className="text-xs text-muted-foreground">créditos</div>
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                R$ {pkg.unitPrice.toFixed(2)}/un
                              </Badge>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-primary">
                              R$ {pkg.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-sm space-y-1">
                            <p className="font-semibold">{pkg.credits} créditos</p>
                            <p className="text-muted-foreground">Preço por unidade: R$ {pkg.unitPrice.toFixed(2)}</p>
                            {savings > 0 && (
                              <>
                                <p className="text-green-500">Economia: R$ {savings.toFixed(2)}</p>
                                <p className="text-green-500 font-medium">{percentOff}% de desconto!</p>
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>

            {/* Section 3: Grandes Volumes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-foreground">Grandes Volumes</h3>
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500">Máximo desconto</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <TooltipProvider>
                  {LARGE_PACKAGES.map((pkg) => {
                    const { savings, percentOff } = calculateSavings(pkg);
                    const index = CREDIT_PACKAGES.findIndex(p => p.credits === pkg.credits);
                    const isPremium = pkg.credits === 1000;
                    
                    return (
                      <Tooltip key={pkg.credits}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleSelectPackage({ ...pkg, popular: false }, index)}
                            className={`p-3 rounded-lg border-2 transition-all text-left relative ${
                              isPremium
                                ? selectedPackage.credits === pkg.credits
                                  ? 'border-amber-400 bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20'
                                  : 'border-amber-400/50 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20'
                                : selectedPackage.credits === pkg.credits
                                  ? 'border-primary bg-primary/10'
                                  : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500'
                            }`}
                          >
                            {isPremium && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                                <Crown className="h-3 w-3" />
                                PREMIUM
                              </div>
                            )}
                            {savings > 0 && !isPremium && (
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                -{percentOff}%
                              </div>
                            )}
                            {isPremium && (
                              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                -{percentOff}%
                              </div>
                            )}
                            <div className={`text-xl font-bold ${isPremium ? 'text-amber-500' : 'text-foreground'}`}>
                              {isPremium && <Gem className="h-4 w-4 inline mr-1 text-amber-500" />}
                              {pkg.credits}
                            </div>
                            <div className="text-xs text-muted-foreground">créditos</div>
                            <div className="mt-1">
                              <Badge variant={isPremium ? "default" : "secondary"} className={`text-[10px] ${isPremium ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0' : ''}`}>
                                R$ {pkg.unitPrice.toFixed(2)}/un
                              </Badge>
                            </div>
                            <div className={`mt-1 text-sm font-semibold ${isPremium ? 'text-amber-500' : 'text-primary'}`}>
                              R$ {pkg.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-sm space-y-1">
                            <p className="font-semibold">{pkg.credits} créditos</p>
                            <p className="text-muted-foreground">Preço por unidade: R$ {pkg.unitPrice.toFixed(2)}</p>
                            {savings > 0 && (
                              <>
                                <p className="text-green-500">Economia: R$ {savings.toFixed(2)}</p>
                                <p className="text-green-500 font-medium">{percentOff}% de desconto!</p>
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>

            {/* Slider Section */}
            <div className="bg-muted/30 rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-4">Ou arraste para selecionar:</p>
              <Slider
                value={[sliderValue]}
                onValueChange={handleSliderChange}
                max={CREDIT_PACKAGES.length - 1}
                step={1}
                className="w-full h-3 [&>span:first-child]:h-3 [&>span:first-child>span]:h-6 [&>span:first-child>span]:w-6 [&>span:first-child>span]:border-4"
              />
              <div className="flex justify-between mt-4 text-xs text-muted-foreground">
                <span>5</span>
                <span>25</span>
                <span>75</span>
                <span>150</span>
                <span>300</span>
                <span>500</span>
                <span>1000</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="p-4 rounded-lg gradient-green text-success-foreground">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm opacity-90">Pacote selecionado</p>
                  <p className="text-2xl font-bold">{selectedPackage.credits} créditos</p>
                  <p className="text-xs opacity-80">R$ {selectedPackage.unitPrice.toFixed(2)} por unidade</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Total</p>
                  <p className="text-2xl font-bold">
                    R$ {selectedPackage.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  {calculateSavings(selectedPackage).savings > 0 && (
                    <p className="text-xs font-medium flex items-center justify-end gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Economia: R$ {calculateSavings(selectedPackage).savings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  className="flex-1 h-12 text-lg bg-white/20 hover:bg-white/30 text-white" 
                  onClick={handleRecharge} 
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
                  {isProcessing ? 'Gerando PIX...' : 'Pagar com PIX'}
                </Button>
                <Button 
                  className="flex-1 h-12 text-lg bg-white/10 text-white/60 cursor-not-allowed relative overflow-hidden" 
                  disabled
                >
                  <Bitcoin className="mr-2 h-5 w-5" />
                  Pagar com Cripto
                  <span className="absolute top-1 right-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                    Em breve
                  </span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Recargas
              </div>
              <Button variant="ghost" size="sm" onClick={fetchPaymentHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma recarga encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(payment.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>R$ {Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell className="font-medium">{payment.credits}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPixModal} onOpenChange={(open) => {
        if (!open && checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        setCheckingPayment(false);
        setShowPixModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento PIX</DialogTitle>
          </DialogHeader>
          
          {!paymentConfirmed && !paymentExpired && (
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${timeRemaining < 60 ? 'text-red-600' : 'text-orange-600'}`}>
                  <Clock className="inline-block mr-2 h-6 w-6" />
                  {formatTime(timeRemaining)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Tempo restante para pagamento</p>
              </div>

              {pixData?.qrCodeBase64 && (
                <div className="text-center">
                  <img 
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
                    alt="QR Code PIX" 
                    className="mx-auto max-w-[200px] border rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Escaneie o QR Code com o app do seu banco
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Ou copie o código PIX:</p>
                <div className="flex gap-2">
                  <code className="flex-1 p-2 text-xs bg-muted rounded break-all max-h-20 overflow-y-auto">
                    {pixData?.qrCode}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyPixCode}>
                    Copiar
                  </Button>
                </div>
              </div>

              {checkingPayment && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando confirmação do pagamento...
                </div>
              )}
            </div>
          )}

          {paymentConfirmed && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-600">Pagamento Confirmado!</h3>
              <p className="text-muted-foreground mt-2">
                Seus créditos foram adicionados à sua conta
              </p>
            </div>
          )}

          {paymentExpired && (
            <div className="text-center py-8">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-600">Pagamento Expirado</h3>
              <p className="text-muted-foreground mt-2">
                O tempo para pagamento expirou. Gere um novo PIX.
              </p>
              <Button className="mt-4" onClick={() => {
                setShowPixModal(false);
                setPixData(null);
              }}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReactCanvasConfetti
        onInit={handleInit}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 9999
        }}
      />
    </DashboardLayout>
  );
}