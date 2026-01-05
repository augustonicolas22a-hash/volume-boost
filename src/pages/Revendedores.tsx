import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Users, CreditCard, Eye } from 'lucide-react';

interface Reseller {
  id: number;
  email: string;
  nome: string;
  creditos: number;
  created_at: string;
}

export default function Revendedores() {
  const { admin, role, loading } = useAuth();
  const navigate = useNavigate();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (admin && role === 'master') {
      fetchResellers();
    }
  }, [admin, role]);

  const fetchResellers = async () => {
    try {
      // Get resellers created by this master using Node.js API
      const data = await api.admins.getResellers(admin!.id);
      setResellers(data || []);
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

  if (!admin) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'master') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Meus Revendedores</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie os revendedores vinculados à sua conta
          </p>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Users className="h-5 w-5 text-primary" />
              Lista de Revendedores
            </CardTitle>
            <CardDescription>
              {resellers.length} revendedor(es) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
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
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[600px] sm:min-w-0 px-4 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead className="hidden sm:table-cell">Data de Criação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resellers.map((reseller) => (
                        <TableRow key={reseller.id}>
                          <TableCell className="font-medium">
                            {reseller.nome || '-'}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{reseller.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <CreditCard className="h-3 w-3" />
                              {reseller.creditos}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">
                            {new Date(reseller.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/revendedor/${reseller.id}`)}
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">Ver Detalhes</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
