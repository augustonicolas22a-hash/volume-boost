import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, CreditCard } from 'lucide-react';
import api from '@/lib/api';

interface TopMaster {
  id: number;
  nome: string;
  email: string;
  totalPurchased: number;
  totalSpent: number;
}

export function TopMasters() {
  const [masters, setMasters] = useState<TopMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopMasters();
  }, []);

  const fetchTopMasters = async () => {
    try {
      // Get all masters from Node.js API
      const mastersData = await api.admins.getAllMasters();

      if (!mastersData) {
        setMasters([]);
        return;
      }

      // Get all transactions
      const transactions = await api.credits.getAllTransactions();

      const masterStats = mastersData.map((master: any) => {
        const masterTx = transactions?.filter(
          (tx: any) => tx.to_admin_id === master.id && tx.transaction_type === 'recharge'
        ) || [];
        const totalPurchased = masterTx.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
        const totalSpent = masterTx.reduce((sum: number, tx: any) => sum + (Number(tx.total_price) || 0), 0);

        return {
          ...master,
          totalPurchased,
          totalSpent,
        };
      });

      // Sort by total spent
      masterStats.sort((a: TopMaster, b: TopMaster) => b.totalSpent - a.totalSpent);

      setMasters(masterStats.slice(0, 5));
    } catch (error) {
      console.error('Error fetching top masters:', error);
      setMasters([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1: return <Medal className="h-5 w-5 text-gray-400" />;
      case 2: return <Award className="h-5 w-5 text-amber-600" />;
      default: return <span className="h-5 w-5 flex items-center justify-center text-muted-foreground font-bold">{index + 1}</span>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Masters
        </CardTitle>
        <CardDescription>
          Masters que mais compraram créditos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {masters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum master encontrado
          </div>
        ) : (
          <div className="space-y-4">
            {masters.map((master, index) => (
              <div
                key={master.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-shrink-0">
                  {getRankIcon(index)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{master.nome}</p>
                  <p className="text-sm text-muted-foreground truncate">{master.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant="secondary" className="gap-1 mb-1">
                    <CreditCard className="h-3 w-3" />
                    {master.totalPurchased.toLocaleString('pt-BR')}
                  </Badge>
                  <p className="text-sm font-semibold text-success">
                    R$ {master.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
