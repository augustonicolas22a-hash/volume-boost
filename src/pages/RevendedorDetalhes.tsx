import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { 
  ArrowLeft, 
  User, 
  CreditCard, 
  FileText, 
  Car, 
  IdCard, 
  GraduationCap,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  Key,
  Mail
} from 'lucide-react';

interface ResellerDetails {
  reseller: {
    id: number;
    nome: string;
    email: string;
    creditos: number;
    rank: string;
    profile_photo: string | null;
    created_at: string;
  };
  stats: {
    totalCreditsReceived: number;
    creditsUsed: number;
    currentBalance: number;
    totalDocuments: number;
    totalCnh: number;
    totalRg: number;
    totalCarteira: number;
  };
  lastService: {
    type: string;
    cpf: string;
    nome: string;
    senha: string;
    validade: string | null;
    created_at: string;
  } | null;
  documents: {
    cnhs: Array<{
      id: number;
      cpf: string;
      nome: string;
      senha: string;
      validade: string;
      created_at: string;
    }>;
    rgs: Array<{
      id: number;
      cpf: string;
      nome: string;
      senha: string;
      validade: string;
      created_at: string;
    }>;
    carteiras: Array<{
      id: number;
      cpf: string;
      nome: string;
      senha: string;
      created_at: string;
    }>;
  };
}

export default function RevendedorDetalhes() {
  const { admin, role, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<ResellerDetails | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (admin && role === 'master' && id) {
      fetchDetails();
    }
  }, [admin, role, id]);

  const fetchDetails = async () => {
    try {
      const data = await api.admins.getResellerDetails(parseInt(id!));
      setDetails(data);
    } catch (err: any) {
      console.error('Error fetching reseller details:', err);
      setError(err.message || 'Erro ao carregar detalhes');
    } finally {
      setLoadingData(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => navigate('/revendedores')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/revendedores')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Detalhes do Revendedor
            </h1>
            <p className="text-sm text-muted-foreground">
              Estatísticas completas da conta
            </p>
          </div>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : details?.reseller ? (
          <>
            {/* Reseller Info Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{details.reseller.nome}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4" />
                        {details.reseller.email}
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Criado em {formatDate(details.reseller.created_at)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {details.reseller.rank}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <CreditCard className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{details.stats.currentBalance}</p>
                      <p className="text-xs text-muted-foreground">Saldo Atual</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{details.stats.totalCreditsReceived}</p>
                      <p className="text-xs text-muted-foreground">Recebidos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{details.stats.creditsUsed}</p>
                      <p className="text-xs text-muted-foreground">Usados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <FileText className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{details.stats.totalDocuments}</p>
                      <p className="text-xs text-muted-foreground">Documentos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Last Service Card */}
            {details.lastService && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5 text-primary" />
                    Último Serviço Criado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-semibold">{details.lastService.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-medium text-sm truncate">{details.lastService.nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <p className="font-mono text-sm">{formatCpf(details.lastService.cpf)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Key className="h-3 w-3" /> Senha
                      </p>
                      <p className="font-mono font-semibold text-primary">{details.lastService.senha}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Criado em</p>
                      <p className="text-sm">{formatDate(details.lastService.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Count Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Car className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{details.stats.totalCnh}</p>
                    <p className="text-xs text-muted-foreground">CNHs Criadas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <IdCard className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{details.stats.totalRg}</p>
                    <p className="text-xs text-muted-foreground">RGs Criados</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <GraduationCap className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{details.stats.totalCarteira}</p>
                    <p className="text-xs text-muted-foreground">Carteiras</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents Tabs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Documentos Criados
                </CardTitle>
                <CardDescription>
                  Últimos 50 documentos de cada tipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="cnh" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="cnh" className="gap-2">
                      <Car className="h-4 w-4" />
                      CNH ({details.documents.cnhs.length})
                    </TabsTrigger>
                    <TabsTrigger value="rg" className="gap-2">
                      <IdCard className="h-4 w-4" />
                      RG ({details.documents.rgs.length})
                    </TabsTrigger>
                    <TabsTrigger value="carteira" className="gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Carteira ({details.documents.carteiras.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="cnh" className="mt-4">
                    {details.documents.cnhs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhuma CNH criada</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Senha</TableHead>
                              <TableHead>Validade</TableHead>
                              <TableHead>Criado em</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.documents.cnhs.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium max-w-[200px] truncate">{doc.nome}</TableCell>
                                <TableCell className="font-mono text-xs">{formatCpf(doc.cpf)}</TableCell>
                                <TableCell className="font-mono font-semibold text-primary">{doc.senha}</TableCell>
                                <TableCell>{doc.validade ? new Date(doc.validade).toLocaleDateString('pt-BR') : '-'}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{formatDate(doc.created_at)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="rg" className="mt-4">
                    {details.documents.rgs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhum RG criado</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Senha</TableHead>
                              <TableHead>Validade</TableHead>
                              <TableHead>Criado em</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.documents.rgs.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium max-w-[200px] truncate">{doc.nome}</TableCell>
                                <TableCell className="font-mono text-xs">{formatCpf(doc.cpf)}</TableCell>
                                <TableCell className="font-mono font-semibold text-primary">{doc.senha}</TableCell>
                                <TableCell>{doc.validade ? new Date(doc.validade).toLocaleDateString('pt-BR') : '-'}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{formatDate(doc.created_at)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="carteira" className="mt-4">
                    {details.documents.carteiras.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhuma carteira criada</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Senha</TableHead>
                              <TableHead>Criado em</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.documents.carteiras.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium max-w-[200px] truncate">{doc.nome}</TableCell>
                                <TableCell className="font-mono text-xs">{formatCpf(doc.cpf)}</TableCell>
                                <TableCell className="font-mono font-semibold text-primary">{doc.senha}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{formatDate(doc.created_at)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Revendedor não encontrado
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}