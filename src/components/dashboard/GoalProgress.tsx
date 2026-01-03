import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Edit2, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export function GoalProgress() {
  const [targetRevenue, setTargetRevenue] = useState(0);
  const [currentRevenue, setCurrentRevenue] = useState(0);
  const [editing, setEditing] = useState(false);
  const [newTarget, setNewTarget] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoalData();
  }, []);

  const fetchGoalData = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Fetch current goal from Node.js API
      const goalData = await api.payments.getGoal(year, month);

      if (goalData) {
        setTargetRevenue(Number(goalData.target_revenue) || 0);
        setNewTarget((goalData.target_revenue || 0).toString());
        setCurrentRevenue(Number(goalData.current_revenue) || 0);
      }
    } catch (error) {
      console.error('Error fetching goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    const value = parseFloat(newTarget);
    if (isNaN(value) || value <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      await api.payments.setGoal(year, month, value);

      setTargetRevenue(value);
      setEditing(false);
      toast.success('Meta atualizada!');
    } catch (error) {
      console.error('Error saving goal:', error);
      toast.error('Erro ao salvar meta');
    }
  };

  const progress = targetRevenue > 0 ? Math.min((currentRevenue / targetRevenue) * 100, 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Meta Mensal
            </CardTitle>
            <CardDescription>
              Progresso de receita do mês atual
            </CardDescription>
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Meta em R$"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              className="flex-1"
            />
            <Button size="icon" variant="ghost" onClick={handleSaveGoal}>
              <Check className="h-4 w-4 text-success" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{progress.toFixed(1)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Atual</p>
                <p className="text-xl font-bold text-success">
                  R$ {currentRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Meta</p>
                <p className="text-xl font-bold text-primary">
                  R$ {targetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {targetRevenue > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Faltam <span className="font-semibold text-foreground">
                    R$ {Math.max(0, targetRevenue - currentRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span> para atingir a meta
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
