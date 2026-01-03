import { cn } from '@/lib/utils';
import logoImage from '@/assets/logo-new.png';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <img
      src={logoImage}
      alt="Data Sistemas"
      className={cn("dark:invert", className)}
    />
  );
}
