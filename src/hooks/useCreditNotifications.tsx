import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useCreditNotifications() {
  const { admin, refreshCredits } = useAuth();

  useEffect(() => {
    if (!admin) return;

    console.log('Setting up credit notifications for admin:', admin.id);

    const channel = supabase
      .channel('credit-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_transactions',
          filter: `to_admin_id=eq.${admin.id}`
        },
        async (payload) => {
          console.log('Credit transaction received:', payload);
          
          const transaction = payload.new as {
            id: number;
            from_admin_id: number | null;
            to_admin_id: number;
            amount: number;
            transaction_type: string;
          };

          // Only notify for transfers (not recharges)
          if (transaction.transaction_type === 'transfer' && transaction.from_admin_id) {
            // Fetch the sender's name
            const { data: sender } = await supabase
              .from('admins')
              .select('nome')
              .eq('id', transaction.from_admin_id)
              .maybeSingle();

            const senderName = sender?.nome || 'Alguém';
            
            toast.success(`💸 Créditos Recebidos!`, {
              description: `${senderName} enviou ${transaction.amount.toLocaleString('pt-BR')} créditos para você!`,
              duration: 5000,
            });

            // Refresh credits to update the UI
            refreshCredits();
          }
        }
      )
      .subscribe((status) => {
        console.log('Credit notifications subscription status:', status);
      });

    return () => {
      console.log('Removing credit notifications channel');
      supabase.removeChannel(channel);
    };
  }, [admin, refreshCredits]);
}
