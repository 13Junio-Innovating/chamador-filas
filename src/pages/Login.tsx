import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Monitor } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Verificar o perfil do usuário nos metadados
      const userMetadata = data.user?.user_metadata;
      const userRole = userMetadata?.perfil || userMetadata?.role || 'atendente';

      // Redirecionar baseado no perfil
      if (userRole === 'admin') {
        navigate("/admin");
      } else {
        navigate("/atendente");
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo ao sistema.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      toast({
        title: "Erro ao fazer login",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${import.meta.env.VITE_BACKGROUND_IMAGE_URL ? 'bg-cover bg-center' : ''} ${import.meta.env.VITE_BACKGROUND_IMAGE_URL ? 'has-bg-image' : ''}`}>
      <Card className="w-full max-w-md p-8 shadow-elevated animate-scale-in backdrop-blur-md bg-white/90">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {import.meta.env.VITE_LOGO_URL ? (
              <img src={import.meta.env.VITE_LOGO_URL} alt="Logo" className="h-12" />
            ) : (
              <div className="bg-primary/10 p-4 rounded-full">
                <Monitor className="w-12 h-12 text-primary" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">Sistema de Chamadas</h1>
          <p className="text-muted-foreground">Acesso para equipe</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button className="text-primary underline" onClick={() => navigate('/reset-password')}>Esqueci minha senha</button>
          <button className="text-primary underline" onClick={() => navigate('/register')}>Cadastrar-se</button>
        </div>

        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Voltar para início
          </Button>
        </div>
      </Card>
    </div>
  );
}
