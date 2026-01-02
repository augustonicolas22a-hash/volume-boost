import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PinPad } from './PinPad';
import { TurnstileWidget, TURNSTILE_ENABLED } from './TurnstileWidget';
import { supabase } from '@/integrations/supabase/client';

interface PendingAdmin {
  id: number;
  nome: string;
  email: string;
  creditos: number;
  rank: string;
  profile_photo: string | null;
  hasPin: boolean;
}

export function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState<PendingAdmin | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const verifyTurnstile = async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-turnstile', {
        body: { token }
      });
      return data?.success === true;
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only check turnstile if enabled
    if (TURNSTILE_ENABLED) {
      if (!turnstileToken) {
        toast.error('Por favor, complete a verificação de segurança');
        return;
      }

      setLoading(true);

      // Verify turnstile token
      const isValid = await verifyTurnstile(turnstileToken);
      if (!isValid) {
        toast.error('Verificação de segurança falhou. Tente novamente.');
        setTurnstileToken(null);
        setLoading(false);
        return;
      }
    } else {
      setLoading(true);
    }

    // Validate login credentials
    const { data, error } = await supabase.rpc('validate_login', {
      p_email: email,
      p_key: password
    });

    if (error || !data || data.length === 0) {
      toast.error('Erro ao fazer login', {
        description: 'Email ou senha incorretos'
      });
      setLoading(false);
      return;
    }

    const adminData = data[0];
    
    // Check if admin has a PIN set
    const { data: adminWithPin } = await supabase
      .from('admins')
      .select('pin')
      .eq('id', adminData.id)
      .single();

    const hasPin = !!adminWithPin?.pin;

    // If it's the owner (dono), skip PIN and login directly
    if (adminData.rank === 'dono') {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        toast.error('Erro ao fazer login');
      } else {
        toast.success('Login realizado com sucesso!');
      }
      setLoading(false);
      return;
    }

    // For master and revendedor, show PIN pad
    setPendingAdmin({
      id: adminData.id,
      nome: adminData.nome,
      email: adminData.email,
      creditos: adminData.creditos,
      rank: adminData.rank,
      profile_photo: adminData.profile_photo,
      hasPin
    });
    
    setLoading(false);
  };

  const handlePinSubmit = async (pin: string) => {
    if (!pendingAdmin) return;
    
    setPinLoading(true);

    try {
      if (pendingAdmin.hasPin) {
        // Verify PIN
        const { data: isValid } = await supabase.rpc('validate_pin', {
          p_admin_id: pendingAdmin.id,
          p_pin: pin
        });

        if (!isValid) {
          toast.error('PIN incorreto');
          setPinLoading(false);
          return;
        }
      } else {
        // Register PIN
        await supabase.rpc('set_admin_pin', {
          p_admin_id: pendingAdmin.id,
          p_pin: pin
        });
        toast.success('PIN registrado com sucesso!');
      }

      // Complete login
      const { error } = await signIn(email, password);
      if (error) {
        toast.error('Erro ao fazer login');
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } catch (err) {
      toast.error('Erro ao processar PIN');
    }

    setPinLoading(false);
  };

  // Show PIN pad if we have a pending admin
  if (pendingAdmin) {
    return (
      <div className="w-full max-w-sm">
        <PinPad
          mode={pendingAdmin.hasPin ? 'verify' : 'register'}
          onSubmit={handlePinSubmit}
          loading={pinLoading}
        />
        <Button 
          variant="ghost" 
          className="w-full mt-4 text-muted-foreground"
          onClick={() => setPendingAdmin(null)}
        >
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-0">
      <CardHeader className="space-y-4 text-center">
        <div className="flex justify-center">
          <Logo className="h-20 w-20" />
        </div>
        <CardDescription className="text-base">Inovando e Recriando o Futuro Digital</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {TURNSTILE_ENABLED && (
            <TurnstileWidget 
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
            />
          )}
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}