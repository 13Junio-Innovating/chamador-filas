import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { Star, Users, Home as HomeIcon, LogIn, LogOut, Printer, Check } from "lucide-react";
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
  const { toast } = useToast();
  const SKIP_APTO_INSERT = (import.meta.env.VITE_SKIP_APTO_INSERT ?? 'true') === 'true';

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
    const maxNumero = rows && rows.length ? (rows[0] as any).numero : 0;
    const maxNumNumber = typeof maxNumero === 'number' ? maxNumero : parseInt(String(maxNumero), 10) || 0;
    return maxNumNumber + 1;
  }

  async function gerarSenhaComposita(tipoCheckin: string, prioridadeNivel: string, numeroApartamento?: string) {
    console.log('gerarSenhaComposita chamada com:', { tipoCheckin, prioridadeNivel, numeroApartamento });
    setIsGenerating(true);
    try {
      // Mapear para tipo legado para compatibilidade
      let tipoLegado: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express" = "normal";
      
      if (tipoCheckin === 'proprietario') {
        tipoLegado = prioridadeNivel === 'prioritario' ? 'preferencial' : 'proprietario';
      } else if (tipoCheckin === 'express') {
        // Temporariamente mapear express para normal até que as migrações sejam aplicadas
        tipoLegado = prioridadeNivel === 'prioritario' ? 'preferencial' : 'normal';
      } else {
        tipoLegado = prioridadeNivel === 'prioritario' ? 'preferencial' : 'normal';
      }

      console.log('Tipo legado mapeado:', tipoLegado);

      try {
        // Obter próximo número (RPC ou fallback)
        const numeroData = await getProximoNumero(tipoLegado);
        console.log('Número obtido:', numeroData);
        // Inserir senha com nova estrutura, incluindo numero_apartamento quando aplicável
        const payloadBase = { numero: numeroData, tipo: tipoLegado, status: 'aguardando' } as any;
        const payload = { ...payloadBase } as any;
        if (tipoCheckin === 'proprietario' && numeroApartamento && !SKIP_APTO_INSERT) {
          payload.numero_apartamento = numeroApartamento;
        }

        let insertData: any;
        let insertError: any;

        ({ data: insertData, error: insertError } = await supabase
          .from('senhas')
          .insert([payload])
          .select('id,numero,tipo,status,hora_retirada')
          .single());

        // Fallback silencioso: se a coluna numero_apartamento não existir no PostgREST (erro PGRST204), reinsere sem o campo
        if (insertError && (insertError.code === 'PGRST204' || /schema cache|numero_apartamento/i.test(insertError.message || ''))) {
          const { data: dataFallback, error: errorFallback } = await supabase
            .from('senhas')
            .insert([payloadBase])
            .select('id,numero,tipo,status,hora_retirada')
            .single();
          if (errorFallback) throw errorFallback;
          insertData = dataFallback;
          // Mantém experiência consistente: exibe sucesso sem aviso de migração
          toast({
            title: 'Senha gerada!',
            description: 'Sua senha foi gerada com sucesso.',
          });
        } else {
          if (insertError) throw insertError;
          toast({
            title: 'Senha gerada!',
            description: 'Sua senha foi gerada com sucesso.',
          });
        }

        console.log('Senha inserida:', insertData);

        setNovaSenha({
          id: insertData?.id as string,
          numero: insertData?.numero as number,
          tipo: insertData?.tipo as "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express",
          tipoCheckin: undefined,
          prioridadeNivel: undefined,
          status: insertData?.status as string,
        });

        setFluxoAtivo(null);
      } catch (supabaseError: any) {
        throw supabaseError;
      }
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

  async function gerarSenha(tipo: "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express") {
    setIsGenerating(true);
    try {
      try {
        // Obter próximo número (RPC ou fallback)
        const numeroData = await getProximoNumero(tipo);

        // Inserir senha com estrutura simplificada
        const { data, error } = await supabase
          .from('senhas')
          .insert([{ 
            numero: numeroData, 
            tipo: tipo,
            status: 'aguardando' 
          }])
          .select()
          .single();

        if (error) throw error;

        console.log('Senha inserida:', data);

        setNovaSenha({
          id: data?.id as string,
          numero: data?.numero as number,
          tipo: data?.tipo as "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express",
          tipoCheckin: undefined,
          prioridadeNivel: undefined,
          status: data?.status as string,
        });
        toast({
          title: "Senha gerada!",
          description: `Sua senha foi gerada com sucesso.`,
        });
      } catch (supabaseError: any) {
        throw supabaseError;
      }
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
      // Mensagem amigável quando o enum do banco não possui 'express'
      if (/invalid input value for enum/i.test(description) && /senha_tipo/i.test(description)) {
        description = "O tipo 'Express' ainda não está habilitado no banco (enum senha_tipo). Aplique as migrações para adicionar 'express' ou execute no SQL: ALTER TYPE senha_tipo ADD VALUE 'express';";
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

    const getPrefixoETipo = (tipo: string) => {
      switch (tipo) {
        case "preferencial": return { prefixo: "P", nome: "Atendimento Preferencial" };
        case "proprietario": return { prefixo: "PR", nome: "Proprietário" };
        case "check-in": return { prefixo: "CI", nome: "Check-in" };
        case "check-out": return { prefixo: "CO", nome: "Check-out" };
        case "hospede": return { prefixo: "H", nome: "Hóspede" };
        default: return { prefixo: "N", nome: "Atendimento Normal" };
      }
    };

    const { prefixo, nome } = getPrefixoETipo(novaSenha.tipo);
    const numero = `${prefixo}${String(novaSenha.numero).padStart(3, "0")}`;
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

  function getTipoNome(tipo: string) {
    switch (tipo) {
      case "preferencial": return "Atendimento Preferencial";
      case "proprietario": return "Proprietário";
      case "check-in": return "Check-in";
      case "check-out": return "Check-out";
      case "express": return "Express";
      case "hospede": return "Hóspede";
      default: return "Atendimento Normal";
    }
  }

  function getTipoNomeComposto(tipoCheckin?: string, prioridadeNivel?: string, tipoLegado?: string) {
    if (tipoCheckin && prioridadeNivel) {
      const nomes = {
        'proprietario_prioritario': 'Proprietário Prioritário',
        'proprietario_comum': 'Proprietário',
        'express_prioritario': 'Express Prioritário',
        'express_comum': 'Express',
        'normal_prioritario': 'Atendimento Preferencial',
        'normal_comum': 'Atendimento Normal'
      };
      return nomes[`${tipoCheckin}_${prioridadeNivel}` as keyof typeof nomes] || getTipoNome(tipoLegado || 'normal');
    }
    return getTipoNome(tipoLegado || 'normal');
  }

  function getPrefixoComposto(tipoCheckin?: string, prioridadeNivel?: string, tipoLegado?: string) {
    if (tipoCheckin && prioridadeNivel) {
      const prefixos = {
        'proprietario_prioritario': 'PP',
        'proprietario_comum': 'P',
        'express_prioritario': 'EP',
        'express_comum': 'E',
        'normal_prioritario': 'NP',
        'normal_comum': 'N'
      };
      return prefixos[`${tipoCheckin}_${prioridadeNivel}` as keyof typeof prefixos] || getPrefixo(tipoLegado || 'normal');
    }
    return getPrefixo(tipoLegado || 'normal');
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
                    onClick={() => gerarSenha("normal")}
                    disabled={isGenerating}
                    className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    size="lg"
                  >
                    <Users className="w-10 h-10" />
                    Atendimento Normal
                  </Button>
                  <Button
                    onClick={() => setFluxoAtivo("check-in")}
                    disabled={isGenerating}
                    className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    size="lg"
                  >
                    <LogIn className="w-10 h-10" />
                    Check-in
                  </Button>

                  <Button
                    onClick={() => gerarSenha("check-out")}
                    disabled={isGenerating}
                    className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                    size="lg"
                  >
                    <LogOut className="w-10 h-10" />
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
                <Check className="w-16 h-16 text-success mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-white">Senha Gerada!</h2>
                <p className="text-white/80">{getTipoNome(novaSenha.tipo)}</p>
              </div>
              
              <div className="bg-white/10 border-2 border-white/20 rounded-lg p-8 mb-6">
                <div className="text-6xl font-bold text-white">
                  {getPrefixo(novaSenha.tipo)}{String(novaSenha.numero).padStart(3, "0")}
                </div>
              </div>

              <p className="text-sm text-white/70 mb-6">
                Aguarde ser chamado. Fique atento ao painel de senhas.
              </p>

              <div className="flex gap-3">
                <Button onClick={imprimirSenha} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20" variant="outline">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button onClick={() => setNovaSenha(null)} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20">
                  Nova Senha
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
