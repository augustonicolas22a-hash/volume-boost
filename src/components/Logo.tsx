import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
    >
      {/* Left D shape */}
      <path
        d="M15 15 L15 85 L45 85 C65 85 75 70 75 50 C75 30 65 15 45 15 L15 15 Z
           M25 25 L45 25 C55 25 65 35 65 50 C65 65 55 75 45 75 L25 75 L25 25 Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      {/* Right mirrored D shape - offset */}
      <path
        d="M85 85 L85 15 L55 15 C35 15 25 30 25 50 C25 70 35 85 55 85 L85 85 Z
           M75 75 L55 75 C45 75 35 65 35 50 C35 35 45 25 55 25 L75 25 L75 75 Z"
        fill="currentColor"
        fillRule="evenodd"
        opacity="0.3"
      />
      {/* Hexagonal accent lines */}
      <path
        d="M30 35 L50 35 M30 50 L60 50 M30 65 L50 65"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
