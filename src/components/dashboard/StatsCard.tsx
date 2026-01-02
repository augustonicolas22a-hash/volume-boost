import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'green' | 'pink' | 'blue' | 'default';
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variant = 'default',
  className 
}: StatsCardProps) {
  const variants = {
    green: 'gradient-green text-success-foreground',
    pink: 'gradient-pink text-accent-foreground',
    blue: 'gradient-blue text-primary-foreground',
    default: 'bg-card text-card-foreground border border-border'
  };

  return (
    <div className={cn(
      'rounded-xl p-6 relative overflow-hidden',
      variants[variant],
      className
    )}>
      {icon && (
        <div className="absolute top-4 right-4 opacity-80">
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <p className={cn(
          'text-sm font-medium',
          variant === 'default' ? 'text-muted-foreground' : 'opacity-90'
        )}>
          {title}
        </p>
        <p className="text-3xl font-bold">
          {value}
        </p>
        {subtitle && (
          <p className={cn(
            'text-sm flex items-center gap-1',
            variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
          )}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
