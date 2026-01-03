import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { 
  Home, 
  CreditCard, 
  Users, 
  BarChart3, 
  LogOut,
  UserPlus,
  Send,
  Crown,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  roles: Array<'dono' | 'master' | 'revendedor'>;
}

const navItems: NavItem[] = [
  { label: 'Início', icon: Home, href: '/dashboard', roles: ['dono', 'master', 'revendedor'] },
  { label: 'Estatísticas', icon: BarChart3, href: '/estatisticas', roles: ['dono'] },
  { label: 'Criar Master', icon: UserPlus, href: '/criar-master', roles: ['dono'] },
  { label: 'Recarregar', icon: CreditCard, href: '/recarregar', roles: ['master'] },
  { label: 'Meus Revendedores', icon: Users, href: '/revendedores', roles: ['master'] },
  { label: 'Transferir Créditos', icon: Send, href: '/transferir', roles: ['master'] },
  { label: 'Criar Revendedor', icon: UserPlus, href: '/criar-revendedor', roles: ['master'] },
];

export function Sidebar() {
  const { role, signOut, admin } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  const getRoleIcon = () => {
    switch (role) {
      case 'dono': return <Crown className="h-4 w-4" />;
      case 'master': return <Shield className="h-4 w-4" />;
      default: return null;
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'dono': return 'Dono';
      case 'master': return 'Master';
      case 'revendedor': return 'Revendedor';
      default: return '';
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <h1 className="text-xl font-bold text-primary">Data Sistemas</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          {getRoleIcon()}
          <span>{getRoleLabel()}</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => (
          <Link key={item.href} to={item.href}>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 h-11 hover:bg-primary/10 hover:text-primary',
                location.pathname === item.href && 'bg-primary/10 text-primary'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-sm text-muted-foreground mb-3 truncate">
          {admin?.email}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
