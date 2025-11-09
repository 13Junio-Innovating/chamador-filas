import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SenhaCard from "@/components/SenhaCard";
import Layout from "@/components/Layout";
import { Phone, CheckCircle, RotateCcw, X, Users, Star } from "lucide-react";
// Removed Radix Select in favor of native select for stability
import type { Tables } from "@/integrations/supabase/types";

export default function Admin() {
  const [senhas, setSenhas] = useState<Tables<'senhas'>[]>([]);
  const [stats, setStats] = useState({ aguardando: 0, chamando: 0, atendidas: 0 });
  const [guiche, setGuiche] = useState<string | null>(null);
  const [atendente, setAtendente] = useState("");
  const { toast } = useToast();

  async function carregar() {
    try {
      const { data, error } = await supabase
        .from('senhas')
        .select('*')
        .order('hora_retirada', { ascending: true });

      if (error) throw error;

      setSenhas(data || []);

      const aguardando = data?.filter(s => s.status === 'aguardando').length || 0;
      const chamando = data?.filter(s => s.status === 'chamando').length || 0;
      const atendidas = data?.filter(s => s.status === 'atendida').length || 0;
      
      setStats({ aguardando, chamando, atendidas });
    } catch (e: unknown) {
      console.error("Erro ao carregar:", e);
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao carregar", description, variant: "destructive" });
    }
  }

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel('admin-senhas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senhas' }, () => {
        carregar();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const chamarProxima = async () => {
    if (!guiche || !atendente) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe guichê e atendente.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Buscar próxima senha aguardando (preferencial tem prioridade)
      const aguardando = senhas.filter(s => s.status === 'aguardando')
        .sort((a, b) => {
          // Preferenciais primeiro
          if (a.tipo === 'preferencial' && b.tipo !== 'preferencial') return -1;
          if (b.tipo === 'preferencial' && a.tipo !== 'preferencial') return 1;
          // Depois por ordem de chegada
          return new Date(a.hora_retirada).getTime() - new Date(b.hora_retirada).getTime();
        });

      if (aguardando.length === 0) {
        toast({
          title: "Sem senhas aguardando",
          description: "Não há senhas na fila.",
          variant: "destructive",
        });
        return;
      }

      const proxima = aguardando[0];

      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'chamando',
          guiche,
          atendente,
          hora_chamada: new Date().toISOString()
        })
        .eq('id', proxima.id);

      if (error) throw error;

      toast({
        title: "Senha chamada!",
        description: `Senha ${proxima.numero} chamada.`,
      });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao chamar", description, variant: "destructive" });
    }
  };

  const finalizar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'atendida',
          hora_atendimento: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Senha finalizada!",
        description: "Atendimento concluído.",
      });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao finalizar", description, variant: "destructive" });
    }
  };

  const voltar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'aguardando',
          guiche: null,
          atendente: null,
          hora_chamada: null
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Senha voltou para fila",
        description: "Senha retornou para aguardando.",
      });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao voltar", description, variant: "destructive" });
    }
  };

  const cancelar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('senhas')
        .update({ status: 'cancelada' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Senha cancelada",
        description: "Senha foi cancelada.",
      });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao cancelar", description, variant: "destructive" });
    }
  };

  const aguardandoNormal = senhas.filter(s => s.status === 'aguardando' && s.tipo !== 'preferencial');
  const aguardandoPreferencial = senhas.filter(s => s.status === 'aguardando' && s.tipo === 'preferencial');
  const chamando = senhas.filter(s => s.status === 'chamando');

  return (
    <Layout showThemeToggle={true}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 gradient-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aguardando</p>
                <p className="text-3xl font-bold text-warning">{stats.aguardando}</p>
              </div>
              <Users className="w-10 h-10 text-warning" />
            </div>
          </Card>
          <Card className="p-6 gradient-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chamando</p>
                <p className="text-3xl font-bold text-primary">{stats.chamando}</p>
              </div>
              <Phone className="w-10 h-10 text-primary" />
            </div>
          </Card>
          <Card className="p-6 gradient-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atendidas Hoje</p>
                <p className="text-3xl font-bold text-success">{stats.atendidas}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
          </Card>
        </div>

        {/* Controles */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Chamar Próxima Senha</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="guiche">Guichê</Label>
              <select
                id="guiche"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={guiche ?? ""}
                onChange={(e) => setGuiche(e.target.value || null)}
              >
                <option value="" disabled>Selecione</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </select>
            </div>
            <div>
              <Label htmlFor="atendente">Atendente</Label>
              <Input
                id="atendente"
                placeholder="Nome do atendente"
                value={atendente}
                onChange={(e) => setAtendente(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={chamarProxima} className="w-full">
                <Phone className="w-4 h-4 mr-2" />
                Chamar Próxima
              </Button>
            </div>
          </div>
        </Card>

        {/* Filas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Aguardando Preferencial */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Fila Preferencial ({aguardandoPreferencial.length})</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {aguardandoPreferencial.map((senha) => (
                <SenhaCard key={senha.id} senha={senha} />
              ))}
              {aguardandoPreferencial.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhuma senha preferencial aguardando</p>
              )}
            </div>
          </Card>

          {/* Aguardando Normal */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Fila Normal ({aguardandoNormal.length})</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {aguardandoNormal.map((senha) => (
                <SenhaCard key={senha.id} senha={senha} />
              ))}
              {aguardandoNormal.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nenhuma senha normal aguardando</p>
              )}
            </div>
          </Card>
        </div>

        {/* Senhas Chamando */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Senhas em Atendimento ({chamando.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chamando.map((senha) => (
              <div key={senha.id} className="space-y-3">
                <SenhaCard senha={senha} />
                <div className="flex gap-2">
                  <Button onClick={() => finalizar(senha.id)} className="flex-1" size="sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Finalizar
                  </Button>
                  <Button onClick={() => voltar(senha.id)} variant="outline" size="sm">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => cancelar(senha.id)} variant="destructive" size="sm">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {chamando.length === 0 && (
              <p className="text-center text-muted-foreground py-8 col-span-full">Nenhuma senha em atendimento</p>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}