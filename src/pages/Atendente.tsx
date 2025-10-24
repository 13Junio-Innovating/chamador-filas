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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

export default function Atendente() {
  const [senhas, setSenhas] = useState<Tables<'senhas'>[]>([]);
  const [stats, setStats] = useState({ aguardando: 0, chamando: 0, atendidas: 0 });
  const [guiche, setGuiche] = useState<string | null>(null);
  const [atendente, setAtendente] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel('atendente-senhas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senhas' }, () => {
        carregar();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function carregar() {
    try {
      const { data, error } = await supabase
        .from('senhas')
        .select('*')
        .order('hora_retirada', { ascending: true });

      if (error) throw error;
      console.log('Dados carregados do Supabase:', data);
      setSenhas(data || []);

      // Calcular estatísticas
      const hoje = new Date().toISOString().split('T')[0];
      const senhasHoje = (data || []).filter(s => s.hora_retirada?.startsWith(hoje));
      
      setStats({
        aguardando: senhasHoje.filter(s => s.status === 'aguardando').length,
        chamando: senhasHoje.filter(s => s.status === 'chamando').length,
        atendidas: senhasHoje.filter(s => s.status === 'atendida').length,
      });
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

  const chamarProxima = async () => {
    if (!guiche || !atendente) {
      toast({ title: "Campos obrigatórios", description: "Informe guichê e atendente.", variant: "destructive" });
      return;
    }

    try {
      const aguardando = senhas.filter(s => s.status === 'aguardando')
        .sort((a, b) => {
          if (a.tipo === 'preferencial' && b.tipo !== 'preferencial') return -1;
          if (b.tipo === 'preferencial' && a.tipo !== 'preferencial') return 1;
          return new Date(a.hora_retirada).getTime() - new Date(b.hora_retirada).getTime();
        });

      if (aguardando.length === 0) {
        toast({ title: "Sem senhas aguardando", description: "Não há senhas na fila.", variant: "destructive" });
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

      console.log('Senha atualizada para chamando:', proxima.id, 'Guichê:', guiche, 'Atendente:', atendente);
      
      // Forçar recarregamento imediato
      await carregar();

      toast({ title: "Senha chamada!", description: `Senha ${proxima.numero} chamada.` });
    } catch (e: unknown) {
      const description = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message?: unknown }).message)
          : String(e);
      toast({ title: "Erro ao chamar", description, variant: "destructive" });
    }
  };

  const chamarSenha = async (senhaId: string) => {
    if (!guiche || !atendente) {
      toast({ title: "Campos obrigatórios", description: "Informe guichê e atendente.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('senhas')
        .update({
          status: 'chamando',
          guiche,
          atendente,
          hora_chamada: new Date().toISOString()
        })
        .eq('id', senhaId);

      if (error) throw error;

      toast({
        title: "Senha chamada!",
        description: `Senha chamada para o guichê ${guiche}.`,
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
        title: "Senha cancelada!",
        description: "Senha foi cancelada com sucesso.",
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

  // Filtrar e ordenar senhas por status e prioridade
  const senhasOrdenadas = senhas.sort((a, b) => {
    // Primeiro por status (aguardando primeiro)
    if (a.status !== b.status) {
      if (a.status === 'aguardando') return -1;
      if (b.status === 'aguardando') return 1;
    }
    
    // Depois por tipo (preferencial primeiro)
    if (a.tipo !== b.tipo) {
      if (a.tipo === 'preferencial') return -1;
      if (b.tipo === 'preferencial') return 1;
    }
    
    // Por último por hora de retirada
    return new Date(a.hora_retirada).getTime() - new Date(b.hora_retirada).getTime();
  });

  const aguardandoNormal = senhasOrdenadas.filter(s => s.status === 'aguardando' && s.tipo !== 'preferencial');
  const aguardandoPreferencial = senhasOrdenadas.filter(s => s.status === 'aguardando' && s.tipo === 'preferencial');
  const chamando = senhasOrdenadas.filter(s => s.status === 'chamando');

  return (
    <Layout showThemeToggle={true} showAdminLink={false} showRelatoriosLink={false} showHomeLink={false}>
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
              <Select value={guiche ?? undefined} onValueChange={(value) => setGuiche(value)}>
                <SelectTrigger id="guiche" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
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
                <div key={senha.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <SenhaCard senha={senha} />
                  </div>
                  <Button 
                    onClick={() => chamarSenha(senha.id)} 
                    size="sm"
                    className="bg-warning hover:bg-warning/90 text-warning-foreground"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Chamar
                  </Button>
                </div>
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
                <div key={senha.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <SenhaCard senha={senha} />
                  </div>
                  <Button 
                    onClick={() => chamarSenha(senha.id)} 
                    size="sm"
                    variant="outline"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Chamar
                  </Button>
                </div>
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