import { useState } from 'react';
import { Search, User, Crown, Users, Mail, Calendar, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';

interface Admin {
  id: number;
  nome: string;
  email: string;
  rank: string;
  creditos: number;
  created_at?: string;
}

export function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (searchQuery.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const data = await api.admins.search(searchQuery);
      setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (rank: string) => {
    switch (rank) {
      case 'dono': return <Crown className="h-4 w-4" />;
      case 'master': return <Users className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (rank: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      dono: 'destructive',
      master: 'default',
      revendedor: 'secondary'
    };
    const labels: Record<string, string> = {
      dono: 'Dono',
      master: 'Master',
      revendedor: 'Revendedor'
    };
    return (
      <Badge variant={variants[rank] || 'secondary'} className="gap-1">
        {getRoleIcon(rank)}
        {labels[rank] || rank}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Buscar Usuários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.nome}</span>
                    {getRoleBadge(user.rank || 'revendedor')}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </span>
                    {user.created_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                    <CreditCard className="h-4 w-4" />
                    {user.creditos.toLocaleString('pt-BR')}
                  </div>
                  <span className="text-xs text-muted-foreground">créditos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
