import { Home, Music, LayoutDashboard, Settings, Shield, DollarSign, LogOut, LogIn } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const mainItems = [
    { title: "Home", url: "/", icon: Home },
  ];

  const userItems = user ? [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Pricing", url: "/pricing", icon: DollarSign },
    { title: "Settings", url: "/settings", icon: Settings },
    { title: "Admin", url: "/admin", icon: Shield },
  ] : [];

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Music className="h-4 w-4 mr-2" />
            {!collapsed && "Musica"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink 
                      to={item.url} 
                      end 
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Navigation */}
        {user && userItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && "Account"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {userItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink 
                        to={item.url} 
                        end
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer with Auth */}
      <SidebarFooter>
        {user ? (
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className={collapsed ? "w-10 h-10 p-0" : "w-full justify-start"}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        ) : (
          <Button
            onClick={() => navigate('/auth')}
            variant="default"
            size="sm"
            className={collapsed ? "w-10 h-10 p-0" : "w-full justify-start"}
          >
            <LogIn className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign In</span>}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
