import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Music, Home, LayoutDashboard, LogIn, LogOut, Menu, X, Settings, Shield, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show navbar when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
        setMobileMenuOpen(false); // Close mobile menu when hiding
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    ...(user ? [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/pricing', label: 'Pricing', icon: DollarSign },
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/admin', label: 'Admin', icon: Shield }
    ] : []),
  ];

  return (
    <nav className={`hidden md:block sticky top-0 z-50 w-full border-b glass-effect transition-transform duration-300 ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-2 font-bold text-xl group smooth-transition hover-lift"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="relative p-2 rounded-lg bg-primary/20 border border-primary/30 pulse-glow">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <span className="gradient-text font-bold">
            Musica
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`relative px-4 py-2 rounded-md text-sm font-medium smooth-transition flex items-center gap-2 ${
                isActive(path)
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {isActive(path) && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-primary-glow animate-scale-in" />
              )}
            </Link>
          ))}
        </div>

        {/* Auth Buttons - Desktop */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="sm"
              className="gap-2 smooth-transition"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="gap-2 pulse-glow smooth-transition">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
