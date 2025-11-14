import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FluxoPerguntasProps {
  tipoInicial: "preferencial" | "proprietario" | "check-in" | "express";
  onTipoSelecionado: (tipoCheckin: string, prioridadeNivel: string, numeroApartamento?: string) => void;
  onVoltar: () => void;
  isGenerating: boolean;
}

type Etapa =
  | 'prioridade'
  | 'checkin_tipo'
  | 'eh_proprietario'
  | 'numero_apartamento'
  | 'fez_web_checkin';

export default function FluxoPerguntas({ tipoInicial, onTipoSelecionado, onVoltar, isGenerating }: FluxoPerguntasProps) {
  const [etapaAtual, setEtapaAtual] = useState<Etapa>(tipoInicial === 'check-in' ? 'eh_proprietario' : 'prioridade');
  const [prioridadeEscolhida, setPrioridadeEscolhida] = useState<string>('comum');
  const [isProprietario, setIsProprietario] = useState<boolean | null>(null);
  const [numeroApartamento, setNumeroApartamento] = useState<string>("");
  const [fezWebCheckin, setFezWebCheckin] = useState<boolean | null>(null);
  

  const handleResposta = (resposta: boolean) => {
    console.log('handleResposta chamada com:', { resposta, etapaAtual, tipoInicial });
    
    if (etapaAtual === 'prioridade') {
      const prioridadeNivel = resposta ? 'prioritario' : 'comum';
      setPrioridadeEscolhida(prioridadeNivel);
      
      console.log('Prioridade escolhida:', prioridadeNivel);
      
      // Para tipos específicos, gerar diretamente
      if (tipoInicial === 'preferencial') {
        console.log('Chamando onTipoSelecionado para preferencial');
        onTipoSelecionado('normal', 'prioritario');
      } else if (tipoInicial === 'proprietario') {
        console.log('Chamando onTipoSelecionado para proprietario');
        onTipoSelecionado('proprietario', prioridadeNivel, numeroApartamento || undefined);
      } else if (tipoInicial === 'express') {
        console.log('Chamando onTipoSelecionado para express');
        onTipoSelecionado('express', prioridadeNivel);
      } else if (tipoInicial === 'check-in') {
        // Decidir tipo de check-in com base nas respostas anteriores
        if (isProprietario) {
          console.log('Fluxo check-in: proprietario → gerar');
          onTipoSelecionado('proprietario', prioridadeNivel, numeroApartamento || undefined);
        } else if (fezWebCheckin) {
          console.log('Fluxo check-in: web → express');
          onTipoSelecionado('express', prioridadeNivel);
        } else {
          console.log('Fluxo check-in: sem web → normal');
          onTipoSelecionado('normal', prioridadeNivel);
        }
      }
    } else if (etapaAtual === 'checkin_tipo') {
      // Compatibilidade (não usado no novo fluxo completo)
      const tipoCheckin = resposta ? 'express' : 'normal';
      console.log('Chamando onTipoSelecionado (compat) para checkin:', { tipoCheckin, prioridadeEscolhida });
      onTipoSelecionado(tipoCheckin, prioridadeEscolhida);
    } else if (etapaAtual === 'eh_proprietario') {
      setIsProprietario(resposta);
      if (resposta) {
        console.log('Check-in: é proprietario → perguntar número do apartamento');
        setEtapaAtual('numero_apartamento');
      } else {
        console.log('Check-in: não é proprietario → perguntar web check-in');
        setEtapaAtual('fez_web_checkin');
      }
    } else if (etapaAtual === 'fez_web_checkin') {
      setFezWebCheckin(resposta);
      console.log('Check-in: perguntar prioridade');
      setEtapaAtual('prioridade');
    }
  };

  const getTituloPergunta = () => {
    if (etapaAtual === 'prioridade') {
      if (tipoInicial === 'preferencial') {
        return "Confirma que é prioritário por lei (gestante, idoso, etc.)?";
      } else {
        return "É prioritário por lei (gestante, idoso, etc.)?";
      }
    } else if (etapaAtual === 'checkin_tipo') {
      return "Fez o Web Check-in?";
    } else if (etapaAtual === 'eh_proprietario') {
      return "É proprietário?";
    } else if (etapaAtual === 'numero_apartamento') {
      return "Informe o número do seu apartamento";
    } else if (etapaAtual === 'fez_web_checkin') {
      return "Fez o Web Check-in?";
    } else if (etapaAtual === 'assinou_efnrh') {
      return "Assinou a E-FNRH?";
    }
    return "";
  };

  const getOpcoes = () => {
    if (etapaAtual === 'prioridade') {
      return [
        { valor: true, texto: "Sim" },
        { valor: false, texto: "Não" }
      ];
    } else if (etapaAtual === 'checkin_tipo') {
      return [
        { valor: true, texto: "Sim" },
        { valor: false, texto: "Não" }
      ];
    } else if (etapaAtual === 'eh_proprietario') {
      return [
        { valor: true, texto: "Sim" },
        { valor: false, texto: "Não" }
      ];
    } else if (etapaAtual === 'fez_web_checkin') {
      return [
        { valor: true, texto: "Sim" },
        { valor: false, texto: "Não" }
      ];
    }
    return [];
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8 shadow-elevated animate-scale-in bg-black/50 backdrop-blur-md border-white/20">
        <div className="mb-6">
          <Button
            onClick={onVoltar}
            variant="ghost"
            className="text-white hover:bg-white/10"
            disabled={isGenerating}
          >
            Voltar
          </Button>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-8 text-white">{getTituloPergunta()}</h2>
          {etapaAtual === 'numero_apartamento' ? (
            <div className="flex flex-col items-center gap-6" key={etapaAtual}>
              <div className="text-4xl font-bold text-white tracking-widest">
                {numeroApartamento || "—"}
              </div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                {["1","2","3","4","5","6","7","8","9","0"].map((num) => (
                  <Button
                    key={`num-${num}`}
                    onClick={() => setNumeroApartamento((prev) => (prev + num).slice(0, 6))}
                    disabled={isGenerating}
                    className="h-16 text-xl bg-white/10 hover:bg-white/20 text-white border-white/20"
                  >
                    {num}
                  </Button>
                ))}
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={() => setNumeroApartamento((prev) => prev.slice(0, -1))}
                  disabled={isGenerating || !numeroApartamento}
                  className="h-12 text-lg bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Apagar
                </Button>
                <Button
                  onClick={() => setNumeroApartamento("")}
                  disabled={isGenerating || !numeroApartamento}
                  className="h-12 text-lg bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Limpar
                </Button>
                <Button
                  onClick={() => setEtapaAtual('prioridade')}
                  disabled={isGenerating || !numeroApartamento.trim()}
                  className="h-12 text-lg bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Continuar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" key={etapaAtual}>
              {getOpcoes().map((opcao) => (
                <Button
                  key={`${etapaAtual}-${opcao.texto}`}
                  onClick={() => handleResposta(opcao.valor)}
                  disabled={isGenerating}
                  className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                  size="lg"
                >
                  {opcao.texto}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}