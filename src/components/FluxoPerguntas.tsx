import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Users, Star, Home as HomeIcon, Zap } from "lucide-react";

interface FluxoPerguntasProps {
  tipoInicial: "preferencial" | "proprietario" | "check-in" | "express";
  onTipoSelecionado: (tipoCheckin: string, prioridadeNivel: string) => void;
  onVoltar: () => void;
  isGenerating: boolean;
}

type Etapa = 'prioridade' | 'checkin_tipo';

export default function FluxoPerguntas({ tipoInicial, onTipoSelecionado, onVoltar, isGenerating }: FluxoPerguntasProps) {
  const [etapaAtual, setEtapaAtual] = useState<Etapa>('prioridade');
  const [prioridadeEscolhida, setPrioridadeEscolhida] = useState<string>('comum');

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
        onTipoSelecionado('proprietario', prioridadeNivel);
      } else if (tipoInicial === 'express') {
        console.log('Chamando onTipoSelecionado para express');
        onTipoSelecionado('express', prioridadeNivel);
      } else if (tipoInicial === 'check-in') {
        // Para check-in, perguntar sobre web check-in
        console.log('Mudando para etapa checkin_tipo');
        setEtapaAtual('checkin_tipo');
      }
    } else if (etapaAtual === 'checkin_tipo') {
      // Resposta sobre web check-in
      const tipoCheckin = resposta ? 'express' : 'normal';
      console.log('Chamando onTipoSelecionado para checkin:', { tipoCheckin, prioridadeEscolhida });
      onTipoSelecionado(tipoCheckin, prioridadeEscolhida);
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
    }
    return "";
  };

  const getOpcoes = () => {
    if (etapaAtual === 'prioridade') {
      return [
        { valor: true, icone: Star, texto: "Sim" },
        { valor: false, icone: Users, texto: "Não" }
      ];
    } else if (etapaAtual === 'checkin_tipo') {
      return [
        { valor: true, icone: Zap, texto: "Sim" },
        { valor: false, icone: Users, texto: "Não" }
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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-8 text-white">{getTituloPergunta()}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {getOpcoes().map((opcao) => (
              <Button
                key={opcao.texto}
                onClick={() => handleResposta(opcao.valor)}
                disabled={isGenerating}
                className="h-32 text-lg flex flex-col gap-3 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
                size="lg"
              >
                <opcao.icone className="w-10 h-10" />
                {opcao.texto}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}