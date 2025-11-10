import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Install from "./pages/Install";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider defaultOpen={true}>
            <div className="flex min-h-screen w-full">
              {/* Sidebar - hidden on mobile, visible on lg+ */}
              <div className="hidden lg:block">
                <AppSidebar />
              </div>
              
              <div className="flex-1 flex flex-col w-full">
                {/* Mobile navbar */}
                <div className="lg:hidden">
                  <Navbar />
                </div>
                
                {/* Desktop trigger */}
                <div className="hidden lg:flex h-14 items-center border-b px-4 bg-background/95 backdrop-blur">
                  <SidebarTrigger />
                  <h1 className="ml-4 text-lg font-semibold">Musica</h1>
                </div>
                
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/admin" element={<Admin />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                
                {/* Mobile Bottom Navigation */}
                <MobileBottomNav />
              </div>
            </div>
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
