import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus, Loader2, QrCode, Copy, Check, Clock, ArrowLeft } from 'lucide-react';
import ReactCanvasConfetti from 'react-canvas-confetti';
import type { CreateTypes } from 'canvas-confetti';
import mysqlApi from '@/lib/api-mysql';

type Step = 'form' | 'payment' | 'success';

interface PixData {
  transactionId: string;
  qrCode: string;
  qrCodeBase64?: string;
  copyPaste: string;
  amount: number;
  credits: number;
}

export default function CriarRevendedor() {
  const { admin, role, loading } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const refAnimationInstance = useRef<CreateTypes | null>(null);

  const handleInit = useCallback(({ confetti }: { confetti: CreateTypes }) => {
    refAnimationInstance.current = confetti;
  }, []);

  const fire = useCallback(() => {
    if (!refAnimationInstance.current) return;
    
    const makeShot = (particleRatio: number, opts: any) => {
      refAnimationInstance.current?.({
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

  // Timer countdown
  useEffect(() => {
    if (step !== 'payment' || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error('Tempo expirado. Gere um novo PIX.');
          setStep('form');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Polling para verificar pagamento
  useEffect(() => {
    if (step !== 'payment' || !pixData) return;

    const checkPayment = async () => {
      try {
        const data = await mysqlApi.payments.getResellerStatus(pixData.transactionId);

        if (data.status === 'PAID') {
          fire();
          toast.success('Pagamento confirmado!', {
            description: 'Revendedor criado com sucesso!'
          });
          setStep('success');
          
          // Play sound
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
          } catch {}
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
      }
    };

    const interval = setInterval(checkPayment, 5000);
    return () => clearInterval(interval);
  }, [step, pixData, fire]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const data = await mysqlApi.payments.createResellerPix({
        masterId: admin.id,
        masterName: admin.nome,
        resellerData: {
          nome: formData.name,
          email: formData.email.toLowerCase().trim(),
          key: formData.password,
        },
      });

      // api-mysql já lança erro com mensagem amigável quando não for ok

      setPixData(data);
      setTimeLeft(600);
      setStep('payment');
      toast.success('PIX gerado! Realize o pagamento para criar o revendedor.');
    } catch (error: any) {
      toast.error('Erro ao gerar PIX', {
        description: error.message
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!pixData?.copyPaste) return;
    
    try {
      await navigator.clipboard.writeText(pixData.copyPaste);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNewReseller = () => {
    setStep('form');
    setFormData({ name: '', email: '', password: '' });
    setPixData(null);
  };

  return (
    <DashboardLayout>
      <ReactCanvasConfetti
        onInit={handleInit}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          zIndex: 100
        }}
      />

      <div className="space-y-8 animate-fade-in max-w-xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Criar Revendedor</h1>
          <p className="text-muted-foreground">
            Adicione um novo revendedor à sua rede
          </p>
        </div>

        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Novo Revendedor
              </CardTitle>
              <CardDescription>
                Preencha os dados e pague <strong>R$90</strong> via PIX. O revendedor receberá <strong>5 créditos</strong> iniciais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Nome do Revendedor"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="revendedor@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-primary">💰 Taxa de ativação: R$90,00</p>
                  <p className="text-sm text-muted-foreground">📦 Créditos iniciais: 5 créditos</p>
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar PIX (R$90)
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 'payment' && pixData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  Pagamento PIX
                </CardTitle>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  timeLeft < 60 ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                }`}>
                  <Clock className="h-4 w-4" />
                  {formatTime(timeLeft)}
                </div>
              </div>
              <CardDescription>
                Escaneie o QR Code ou copie o código para pagar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Criando revendedor:</p>
                <p className="font-semibold">{formData.name}</p>
                <p className="text-sm text-muted-foreground">{formData.email}</p>
              </div>

              {pixData.qrCodeBase64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border"
                  />
                </div>
              )}

              <div className="text-center">
                <p className="text-3xl font-bold text-primary">R$ 90,00</p>
                <p className="text-sm text-muted-foreground">= 5 créditos para o revendedor</p>
              </div>

              <div className="space-y-2">
                <Label>Código Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input
                    value={pixData.copyPaste}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Aguardando confirmação do pagamento...
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep('form')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'success' && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                Revendedor Criado!
              </CardTitle>
              <CardDescription>
                O revendedor foi criado com sucesso e já pode acessar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background rounded-lg border space-y-2">
                <p><strong>Nome:</strong> {formData.name}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p><strong>Créditos:</strong> 5</p>
              </div>
              <Button onClick={handleNewReseller} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Criar Outro Revendedor
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
