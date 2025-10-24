import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Monitor, BarChart3, LogOut, Settings, Sun, Moon, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";

interface LayoutProps {
  children: ReactNode;
  showAdminLink?: boolean;
  showPainelLink?: boolean;
  showRelatoriosLink?: boolean;
  showThemeToggle?: boolean;
  showHomeLink?: boolean;
}

export default function Layout({ children, showAdminLink = true, showPainelLink = true, showRelatoriosLink = true, showThemeToggle = false, showHomeLink = true }: LayoutProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <nav className="bg-card border-b shadow-soft sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
                {import.meta.env.VITE_LOGO_URL ? (
                  <img src={import.meta.env.VITE_LOGO_URL} alt="Logo" className="h-8 w-auto" />
                ) : (
                  <Monitor className="w-6 h-6" />
                )}
                <span className="hidden sm:inline">Sistema de Chamadas</span>
              </Link>
              <div className="hidden md:flex space-x-4">
                {showHomeLink && (
                  <Link to="/">
                    <Button variant="ghost" size="sm">
                      <Home className="w-4 h-4 mr-2" />
                      Início
                    </Button>
                  </Link>
                )}
                {showAdminLink && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Administração
                    </Button>
                  </Link>
                )}
                {showPainelLink && (
                  <Link to="/painel">
                    <Button variant="ghost" size="sm">
                      <Monitor className="w-4 h-4 mr-2" />
                      Painel
                    </Button>
                  </Link>
                )}
                {showRelatoriosLink && (
                  <Link to="/relatorios">
                    <Button variant="ghost" size="sm">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Relatórios
                    </Button>
                  </Link>
                )}
                {showRelatoriosLink && (
                  <Link to="/relatorios-backend">
                    <Button variant="ghost" size="sm">
                      <Database className="w-4 h-4 mr-2" />
                      Relatórios API
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showThemeToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Alternar tema"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="animate-fade-in">{children}</main>
    </div>
  );
}