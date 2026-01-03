import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Wallet, DollarSign } from 'lucide-react';
import api from '@/lib/api';

interface MetricsData {
  totalDeposits: number;
  totalDepositValue: number;
  totalTransfers: number;
  totalTransferCredits: number;
  avgTicket: number;
}

export function DepositTransferMetrics() {
  const [metrics, setMetrics] = useState<MetricsData>({
    totalDeposits: 0,
    totalDepositValue: 0,
    totalTransfers: 0,
    totalTransferCredits: 0,
    avgTicket: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const data = await api.credits.getMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Depósitos',
      value: metrics.totalDeposits,
      subtitle: 'operações',
      icon: ArrowDownCircle,
      iconColor: 'text-success',
    },
    {
      title: 'Valor Depositado',
      value: `R$ ${metrics.totalDepositValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      subtitle: 'receita total',
      icon: DollarSign,
      iconColor: 'text-success',
    },
    {
      title: 'Total Transferências',
      value: metrics.totalTransfers,
      subtitle: 'operações',
      icon: ArrowUpCircle,
      iconColor: 'text-primary',
    },
    {
      title: 'Ticket Médio',
      value: `R$ ${metrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      subtitle: 'por depósito',
      icon: Wallet,
      iconColor: 'text-accent',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
