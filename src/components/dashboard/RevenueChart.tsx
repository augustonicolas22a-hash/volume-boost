import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import api from '@/lib/api';

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
      const monthlyData = await api.credits.getMonthlyData();
      setData(monthlyData || []);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      // Fallback to empty data
      setData([]);
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
