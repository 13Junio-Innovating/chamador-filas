import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

 
import FluxoPerguntas from "@/components/FluxoPerguntas";

interface NovaSenha {
  id?: string;
  numero: number;
  tipo: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express";
  tipoCheckin?: string;
  prioridadeNivel?: string;
  status: string;
}

type TipoFluxo = "preferencial" | "proprietario" | "check-in" | "express" | null;

export default function Home() {
  const [novaSenha, setNovaSenha] = useState<NovaSenha | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fluxoAtivo, setFluxoAtivo] = useState<TipoFluxo>(null);
  const [prioridadeTipo, setPrioridadeTipo] = useState<null | "atendimento" | "check-out">(null);
  const [categoriaAtual, setCategoriaAtual] = useState<null | "atendimento" | "check-out" | "check-in:express" | "check-in:normal" | "check-in:proprietario">(null);
  const [prioridadeAtual, setPrioridadeAtual] = useState<null | "prioritario" | "comum">(null);

  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    if (path === '/atendimento') {
      setPrioridadeTipo('atendimento');
    } else if (path === '/check-out') {
      setPrioridadeTipo('check-out');
    } else {
      setPrioridadeTipo(null);
    }
  }, [location.pathname]);

  // Fallback: tenta RPC; se não existir, busca o maior número e incrementa
  async function getProximoNumero(tipo: string) {
    try {
      const { data, error } = await supabase.rpc('get_proximo_numero_senha', { tipo_senha: tipo as "check-in" | "check-out" | "express" | "normal" | "preferencial" | "proprietario" });
      if (!error && typeof data === 'number') {
        return data;
      }
    } catch (e) {
      // Ignora e segue para fallback
    }
    const { data: rows, error: selError } = await supabase
      .from('senhas')
      .select('numero')
      .eq('tipo', tipo as "preferencial" | "proprietario" | "check-in" | "express" | "normal" | "check-out")
      .order('numero', { ascending: false })
      .limit(1);
    if (selError) throw selError;
    const maxNumero = rows && rows.length ? (rows[0] as { numero: number | string }).numero : 0;
    const maxNumNumber = typeof maxNumero === 'number' ? maxNumero : parseInt(String(maxNumero), 10) || 0;
    return maxNumNumber + 1;
  }

  async function gerarSenhaComposita(tipoCheckin: 'normal' | 'express' | 'proprietario', prioridadeNivel: 'prioritario' | 'comum', numeroApartamento?: string, efnrhAssinada?: boolean) {
    setIsGenerating(true);
    try {
        // Obter próximo número (RPC ou fallback)
        const numeroData = await getProximoNumero('check-in');

        const tipoLegado: "check-in" = 'check-in';
        // Construir payload tipado (sem any)
        type SenhaInsertExtended = TablesInsert<'senhas'> & { numero_apartamento?: string };
        const payloadBase: SenhaInsertExtended = { numero: numeroData, tipo: tipoLegado, status: 'aguardando' };
        const payload: SenhaInsertExtended = { ...payloadBase };
        // Adicionar tags de observações para composição (inclui E-FNRH)
        const tags = [`checkin:${tipoCheckin}`, `prioridade:${prioridadeNivel}`, `efnrh:${efnrhAssinada ? 'sim' : 'nao'}`];
        payload.observacoes = payload.observacoes ? `${payload.observacoes}; ${tags.join('; ')}` : tags.join('; ');
        // Sempre incluir numero_apartamento para proprietario quando fornecido;
        // também gravar em 'observacoes' para garantir visibilidade nos relatórios
        if (tipoCheckin === 'proprietario' && numeroApartamento) {
          payload.numero_apartamento = numeroApartamento;
          payload.observacoes = payload.observacoes ? `${payload.observacoes}; Apartamento ${numeroApartamento}` : `Apartamento ${numeroApartamento}`;
        }

        let insertData: Tables<'senhas'> | null;
        let insertError: PostgrestError | null;

        ({ data: insertData, error: insertError } = await supabase
          .from('senhas')
          .insert([payload])
          .select('id,numero,tipo,status,hora_retirada')
          .single());

        // Fallbacks silenciosos para lidar com cache de schema ou colunas ausentes
        if (insertError) {
          const msg = String(insertError.message || '');
          const code = String(insertError.code || '');
          const mentionsObs = /observacoes/i.test(msg);
          const mentionsApto = /numero_apartamento/i.test(msg);
          const shouldFallback = /schema cache/i.test(msg) || code === 'PGRST204' || mentionsObs || mentionsApto;

          if (shouldFallback) {
            // Primeiro tenta sem 'observacoes', preservando 'numero_apartamento' se existir
            if (mentionsObs && payload.observacoes) {
              const payloadSemObs: SenhaInsertExtended = { ...payloadBase, ...(payload.numero_apartamento ? { numero_apartamento: payload.numero_apartamento } : {}) };
              const res = await supabase
                .from('senhas')
                .insert([payloadSemObs])
                .select('id,numero,tipo,status,hora_retirada')
                .single();
              insertData = res.data as Tables<'senhas'>;
              insertError = res.error as PostgrestError | null;
            }
            // Se ainda falhar por conta de 'numero_apartamento', tenta sem ele
            if (insertError && mentionsApto && payload.numero_apartamento) {
              const payloadSemApto: TablesInsert<'senhas'> = { ...payloadBase };
              delete (payloadSemApto as { numero_apartamento?: string }).numero_apartamento;
              const res = await supabase
                .from('senhas')
                .insert([payloadSemApto])
                .select('id,numero,tipo,status,hora_retirada')
                .single();
              insertData = res.data as Tables<'senhas'>;
              insertError = res.error as PostgrestError | null;
            }
          }

          if (insertError) throw insertError;
        }

        // Mapear categoria sem usar any
        const categoriaMap = {
          express: 'check-in:express',
          normal: 'check-in:normal',
          proprietario: 'check-in:proprietario',
        } as const;
        setCategoriaAtual(categoriaMap[tipoCheckin]);
        setPrioridadeAtual(prioridadeNivel === 'prioritario' ? 'prioritario' : 'comum');

        const nova: NovaSenha = {
          id: insertData!.id,
          numero: insertData!.numero,
          tipo: tipoLegado,
          status: insertData!.status,
          tipoCheckin: tipoCheckin,
          prioridadeNivel: prioridadeNivel,
        };

        setNovaSenha(nova);
        // Mensagem detalhada com tipo composto
        const tipoMsg = getTipoNomeComposto(nova.tipoCheckin, nova.prioridadeNivel, nova.tipo);
        toast({ title: "Senha gerada!", description: tipoMsg });
      } catch (error: unknown) {
        console.error('Erro ao gerar senha composta:', error);
        const e = error as { message?: string; details?: string; hint?: string; code?: string };
        const description = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(' — ') || String(error);
        toast({ title: "Erro ao gerar senha", description, variant: "destructive" });
      } finally {
        setIsGenerating(false);
      }
  }

  async function gerarSenha(tipo: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express", observacoes?: string) {
    setIsGenerating(true);
    try {
        // Obter próximo número (RPC ou fallback)
        const numeroData = await getProximoNumero(tipo);

        // Inserir senha com estrutura tipada

        const res = await supabase
          .from('senhas')
          .insert([{ 
            numero: numeroData, 
            tipo,
            status: 'aguardando',
            ...(observacoes ? { observacoes } : {})
          } as TablesInsert<'senhas'>])
          .select()
          .single();
        let data = res.data as Tables<'senhas'> | null;
        const error = res.error as PostgrestError | null;

        if (error) {
          const msg = String(error.message || '');
          const isSchemaCache = error.code === 'PGRST204' || /schema cache/i.test(msg) || /observacoes/i.test(msg);
          if (isSchemaCache) {
            const retry = await supabase
              .from('senhas')
              .insert([{ numero: numeroData, tipo, status: 'aguardando' } as TablesInsert<'senhas'>])
              .select()
              .single();
            if (retry.error) throw retry.error;
            data = retry.data as Tables<'senhas'>;
          } else {
            throw error;
          }
        }

        setNovaSenha({
          id: data?.id as string,
          numero: data?.numero as number,
          tipo: data?.tipo as "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express",
          tipoCheckin: categoriaAtual?.startsWith('check-in:') ? (categoriaAtual.split(':')[1] as 'express' | 'normal' | 'proprietario') : undefined,
          prioridadeNivel: prioridadeAtual || undefined,
          status: data?.status as string,
        });
        toast({
          title: "Senha gerada!",
          description: getNomeTicket(),
        });
    } catch (error: unknown) {
      console.error("Erro ao gerar senha:", error);
      let description = "";
      if (error && typeof error === "object") {
        const errorObj = error as { message?: string; details?: string; hint?: string; code?: string };
        description = [errorObj.message, errorObj.details, errorObj.hint, errorObj.code].filter(Boolean).join(" — ");
      }
      if (!description) {
        description = error instanceof Error ? error.message : String(error);
      }
      toast({
        title: "Erro ao gerar senha",
        description,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const imprimirSenha = () => {
    if (!novaSenha) return;

    const nome = getNomeTicket();
    const numero = getCodigoTicket();
    const w = window.open("", "_blank");

    if (!w || !w.document) {
      toast({
        title: "Erro ao imprimir",
        description: "Não foi possível abrir a janela de impressão.",
        variant: "destructive",
      });
      return;
    }

    w.document.write(`
      <html><head><title>${numero}</title>
      <style>
        body{font-family:Arial; padding:20px; text-align:center}
        .ticket{border:2px dashed hsl(192 85% 42%); padding:30px; width:300px; margin:20px auto; background:hsl(192 40% 98%)}
        .numero{font-size:48px; font-weight:bold; color:hsl(192 85% 42%); margin:20px 0}
      </style></head><body>
      <div class="ticket">
        <div>Resort Costão do Santinho</div>
        <div>${nome}</div>
        <div class="numero">${numero}</div>
        <div>Aguarde ser chamado</div>
      </div></body></html>
    `);
    w.document.close();
    w.print();
    // Após imprimir, retornar à seleção
    setNovaSenha(null);
    setFluxoAtivo(null);
    setCategoriaAtual(null);
    setPrioridadeAtual(null);
  };

  function getPrefixo(tipo: string) {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      case "express": return "E";
      case "hospede": return "H";
      default: return "N";
    }
  }

  const getTipoNome = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t === "preferencial") return "Atendimento – Prioritário";
    if (t === "proprietario") return "Atendimento – Proprietário";
    if (t === "check-in") return "Check-in";
    if (t === "check-out") return "Check-out";
    if (t === "express") return "Atendimento – Express";
    return "Atendimento – Comum";
  };

  function getTipoNomeComposto(tipoCheckin?: string, prioridadeNivel?: string, tipoLegado?: string) {
    if (tipoCheckin && prioridadeNivel) {
      const key = `${tipoCheckin}_${prioridadeNivel}`;
      const nomes: Record<string, string> = {
        'proprietario_prioritario': 'Proprietário - Prioridade',
        'proprietario_comum': 'Proprietário - Comum',
        'express_prioritario': 'Express - Prioritário',
        'express_comum': 'Express - Comum',
        'normal_prioritario': 'Normal - Prioridade',
        'normal_comum': 'Normal - Comum',
      };
      return nomes[key] || getTipoNome(tipoLegado || 'normal');
    }
    return getTipoNome(tipoLegado || 'normal');
  }

  function getPrefixoComposto(tipoCheckin?: string, prioridadeNivel?: string, tipoLegado?: string) {
    if (tipoCheckin && prioridadeNivel) {
      const prefixos = {
        'proprietario_prioritario': 'CIPP',
        'proprietario_comum': 'CIPC',
        'express_prioritario': 'CIEP',
        'express_comum': 'CIEC',
        'normal_prioritario': 'CINP',
        'normal_comum': 'CIEN',
      };
      return prefixos[`${tipoCheckin}_${prioridadeNivel}` as keyof typeof prefixos] || getPrefixo(tipoLegado || 'normal');
    }
    return getPrefixo(tipoLegado || 'normal');
  }
  function getNomeTicket() {
    if (novaSenha?.tipoCheckin && novaSenha?.prioridadeNivel) {
      return getTipoNomeComposto(novaSenha.tipoCheckin, novaSenha.prioridadeNivel, novaSenha.tipo);
    }
    if (categoriaAtual === 'atendimento') {
      return prioridadeAtual === 'prioritario' ? 'Atendimento – Prioritário Lei' : 'Atendimento – Comum';
    }
    if (categoriaAtual === 'check-out') {
      return prioridadeAtual === 'prioritario' ? 'Check-out – Prioritário Lei' : 'Check-out – Comum';
    }
    return getTipoNome(novaSenha?.tipo || 'normal');
  }

  function getCodigoTicket() {
    if (novaSenha?.tipoCheckin && novaSenha?.prioridadeNivel) {
      const prefixo = getPrefixoComposto(novaSenha.tipoCheckin, novaSenha.prioridadeNivel, novaSenha.tipo);
      return `${prefixo}-${String(novaSenha.numero).padStart(4, "0")}`;
    }
    if (categoriaAtual === 'atendimento') {
      const prefixo = prioridadeAtual === 'prioritario' ? 'ATNP' : 'ATNC';
      return `${prefixo}-${String(novaSenha?.numero || 0).padStart(4, "0")}`;
    }
    if (categoriaAtual === 'check-out') {
      const prefixo = prioridadeAtual === 'prioritario' ? 'COXP' : 'COXC';
      return `${prefixo}-${String(novaSenha?.numero || 0).padStart(4, "0")}`;
    }
    return `${getPrefixo(novaSenha?.tipo || 'normal')}${String(novaSenha?.numero || 0).padStart(3, "0")}`;
  }

  return (
    <div className="min-h-screen gradient-ocean relative overflow-hidden">
      {/* Background vídeo YouTube */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <iframe
          className="absolute top-1/2 left-1/2 w-[177.77777778vh] h-[56.25vw] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
          src="https://www.youtube.com/embed/_TUU487uR38?autoplay=1&mute=1&loop=1&playlist=_TUU487uR38&start=35&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1"
          allow="autoplay; encrypted-media"
          frameBorder="0"
          title="Tour Virtual Costão do Santinho"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-12 animate-fade-in">
          {import.meta.env.VITE_LOGO_URL && (
            <div className="flex justify-center mb-6">
              <img src={import.meta.env.VITE_LOGO_URL} alt="Logo" className="h-14 w-auto" />
            </div>
          )}
          <h1 className="text-5xl font-bold text-white mb-4">Resort Costao do Santinho</h1>
        </div>

        {!novaSenha ? (
          fluxoAtivo ? (
            <FluxoPerguntas 
              tipoInicial={fluxoAtivo as Exclude<TipoFluxo, null>}
              onTipoSelecionado={gerarSenhaComposita}
              onVoltar={() => setFluxoAtivo(null)}
              isGenerating={isGenerating}
            />
          ) : (
            <div className="max-w-4xl mx-auto">
              <Card className="p-8 shadow-elevated animate-scale-in bg-black/50 backdrop-blur-md border-white/20">
                <h2 className="text-2xl font-bold text-center mb-8 text-white">Selecione o tipo de atendimento</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Button
                    onClick={() => navigate('/atendimento')}
                    disabled={isGenerating}
                    className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    size="lg"
                  >
                    Atendimento
                  </Button>
                  <Button
                    onClick={() => setFluxoAtivo("check-in")}
                    disabled={isGenerating}
                    className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    size="lg"
                  >
                    Check-in
                  </Button>

                  <Button
                    onClick={() => navigate('/check-out')}
                    disabled={isGenerating}
                    className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    size="lg"
                  >
                    Check-out
                  </Button>

                  {/* Botões Proprietário, Express e Preferencial removidos conforme solicitado */}
                </div>
              </Card>
            </div>
          )
        ) : (
          <div className="max-w-md mx-auto">
            <Card className="p-8 text-center shadow-elevated animate-scale-in bg-black/50 backdrop-blur-md border-white/20">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 text-white">Senha Gerada!</h2>
                <p className="text-white/80">{getNomeTicket()}</p>
              </div>
              
              <div className="bg-white/10 border-2 border-white/20 rounded-lg p-8 mb-6">
                <div className="text-6xl font-bold text-white">
                  {getCodigoTicket()}
                </div>
              </div>

              <p className="text-sm text-white/70 mb-6">
                Aguarde ser chamado. Fique atento ao painel de senhas.
              </p>

              <div className="flex gap-3">
                <Button onClick={imprimirSenha} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20" variant="outline">Imprimir</Button>
                <Button onClick={() => { setNovaSenha(null); setFluxoAtivo(null); setCategoriaAtual(null); setPrioridadeAtual(null); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20">Nova Senha</Button>
              </div>

            </Card>
          </div>
        )}
        {prioridadeTipo && (
          <div className="max-w-4xl mx-auto mt-8">
            <Card className="p-8 shadow-elevated animate-scale-in bg-black/50 backdrop-blur-md border-white/20">
              <div className="mb-6">
                <Button
                  onClick={() => navigate('/')}
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  disabled={isGenerating}
                >
                  Voltar
                </Button>
              </div>
              <h2 className="text-2xl font-bold text-center mb-8 text-white">É prioritário por lei (gestante, idoso, PCD, etc.)?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Button
                  onClick={() => {
                    if (prioridadeTipo === 'atendimento') {
                      setCategoriaAtual('atendimento');
                      setPrioridadeAtual('prioritario');
                      gerarSenha('preferencial');
                    } else if (prioridadeTipo === 'check-out') {
                      setCategoriaAtual('check-out');
                      setPrioridadeAtual('prioritario');
                      gerarSenha('check-out', 'Prioritário Lei');
                    }
                    setPrioridadeTipo(null);
                  }}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  Sim
                </Button>
                <Button
                  onClick={() => {
                    if (prioridadeTipo === 'atendimento') {
                      setCategoriaAtual('atendimento');
                      setPrioridadeAtual('comum');
                      gerarSenha('normal');
                    } else if (prioridadeTipo === 'check-out') {
                      setCategoriaAtual('check-out');
                      setPrioridadeAtual('comum');
                      gerarSenha('check-out', 'Comum');
                    }
                    setPrioridadeTipo(null);
                  }}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  Não
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
