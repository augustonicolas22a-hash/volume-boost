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
  Shield,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import logo from '@/assets/logo.png';

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

export function MobileNav() {
  const { role, signOut, admin } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

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
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Data Sistemas" className="h-8 w-8 dark:invert" />
          <div>
            <h1 className="text-lg font-bold text-primary">Data Sistemas</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getRoleIcon()}
              <span>{getRoleLabel()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <img src={logo} alt="Data Sistemas" className="h-10 w-10 dark:invert" />
                    <h1 className="text-xl font-bold text-primary">Data Sistemas</h1>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    {getRoleIcon()}
                    <span>{getRoleLabel()}</span>
                  </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {filteredItems.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <Link to={item.href}>
                        <Button
                          variant="ghost"
                          className={cn(
                            'w-full justify-start gap-3 h-11',
                            location.pathname === item.href && 'bg-primary/10 text-primary'
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Button>
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                <div className="p-4 border-t border-border mt-auto">
                  <div className="text-sm text-muted-foreground mb-3 truncate">
                    {admin?.email}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    Sair
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
