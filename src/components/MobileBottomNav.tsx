import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, DollarSign, Settings, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

export const MobileBottomNav = () => {
  const location = useLocation();
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    ...(user ? [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/pricing', icon: DollarSign, label: 'Pricing' },
      { path: '/settings', icon: Settings, label: 'Settings' },
    ] : [
      { path: '/auth', icon: User, label: 'Sign In' },
    ]),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-effect border-t">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`relative flex flex-col items-center justify-center flex-1 gap-1 py-2 smooth-transition ${
              isActive(path)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className={`relative smooth-transition ${isActive(path) ? 'scale-110' : ''}`}>
              <Icon className="h-5 w-5" />
              {isActive(path) && (
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse-slow" />
              )}
            </div>
            <span className="text-xs font-medium">{label}</span>
            {isActive(path) && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-primary to-primary-glow rounded-full animate-scale-in" />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};
