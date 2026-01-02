import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyData {
  month: string;
  deposits: number;
  transfers: number;
}

const chartConfig = {
  deposits: {
    label: 'Depósitos',
    color: 'hsl(var(--success))',
  },
  transfers: {
    label: 'Transferências',
    color: 'hsl(var(--primary))',
  },
};

export function RevenueChart() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlyData();
  }, []);

  const fetchMonthlyData = async () => {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      const { data: transactions } = await supabase
        .from('credit_transactions')
        .select('amount, total_price, transaction_type, created_at')
        .gte('created_at', sixMonthsAgo.toISOString());

      const monthlyMap = new Map<string, { deposits: number; transfers: number }>();

      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(key, { deposits: 0, transfers: 0 });
      }

      transactions?.forEach((tx) => {
        const date = new Date(tx.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (monthlyMap.has(key)) {
          const current = monthlyMap.get(key)!;
          if (tx.transaction_type === 'recharge') {
            current.deposits += tx.total_price || 0;
          } else {
            current.transfers += tx.amount || 0;
          }
        }
      });

      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      const chartData = Array.from(monthlyMap.entries()).map(([key, values]) => {
        const [, month] = key.split('-');
        return {
          month: months[parseInt(month) - 1],
          deposits: Number(values.deposits.toFixed(2)),
          transfers: values.transfers,
        };
      });

      setData(chartData);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Receita Mensal
        </CardTitle>
        <CardDescription>
          Depósitos (R$) e Transferências (créditos) dos últimos 6 meses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar 
                dataKey="deposits" 
                fill="hsl(var(--success))" 
                radius={[4, 4, 0, 0]}
                name="Depósitos (R$)"
              />
              <Bar 
                dataKey="transfers" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="Transferências"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
