import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Users, CreditCard } from 'lucide-react';

interface Reseller {
  id: string;
  email: string;
  name: string | null;
  balance: number;
  created_at: string;
}

export default function Revendedores() {
  const { user, role, loading } = useAuth();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user && role === 'master') {
      fetchResellers();
    }
  }, [user, role]);

  const fetchResellers = async () => {
    try {
      const { data: relationships } = await supabase
        .from('reseller_relationships')
        .select('reseller_id')
        .eq('master_id', user!.id);

      if (!relationships?.length) {
        setResellers([]);
        setLoadingData(false);
        return;
      }

      const resellerIds = relationships.map(r => r.reseller_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, name, created_at')
        .in('id', resellerIds);

      const { data: credits } = await supabase
        .from('credits')
        .select('user_id, balance')
        .in('user_id', resellerIds);

      const combined = profiles?.map(profile => ({
        ...profile,
        balance: credits?.find(c => c.user_id === profile.id)?.balance || 0
      })) || [];

      setResellers(combined);
    } catch (error) {
      console.error('Error fetching resellers:', error);
    } finally {
      setLoadingData(false);
    }
  };

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

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Revendedores</h1>
          <p className="text-muted-foreground">
            Gerencie os revendedores vinculados à sua conta
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Lista de Revendedores
            </CardTitle>
            <CardDescription>
              {resellers.length} revendedor(es) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : resellers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Você ainda não possui revendedores</p>
                <p className="text-sm">Crie um revendedor para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Data de Criação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellers.map((reseller) => (
                    <TableRow key={reseller.id}>
                      <TableCell className="font-medium">
                        {reseller.name || '-'}
                      </TableCell>
                      <TableCell>{reseller.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <CreditCard className="h-3 w-3" />
                          {reseller.balance}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(reseller.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
