import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

// Tipos fortes para senhas exibidas no painel
type SenhaStatus = "aguardando" | "chamando" | "atendida" | "cancelada";
type SenhaTipo = "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express";
type Senha = Tables<'senhas'>;

// Declarar webkitAudioContext sem usar any
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const formatTempo = (inicio: string) => {
  const agora = new Date().getTime();
  const horaInicio = new Date(inicio).getTime();
  const diffMs = agora - horaInicio;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  return `${diffMins}:${String(diffSecs).padStart(2, '0')}`;
};

function normalizeTipo(tipo: string): string {
  return tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Tipos específicos para a fila de anúncios
interface AnuncioSenha {
  tipo: 'senha';
  dados: Senha;
}

interface AnuncioGrupo {
  tipo: 'grupo';
  dados: Senha[];
}

type AnuncioItem = AnuncioSenha | AnuncioGrupo;

export default function Painel() {
  const [chamando, setChamando] = useState<Senha[]>([]);
  const [proximas, setProximas] = useState<Senha[]>([]);
  const [finalizadas, setFinalizadas] = useState<Senha[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [tempos, setTempos] = useState<Record<string, string>>({});
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  
  // Sistema de fila de anúncios com tipos específicos
  const [filaAnuncios, setFilaAnuncios] = useState<AnuncioItem[]>([]);
  const [anunciandoAtualmente, setAnunciandoAtualmente] = useState(false);

  // Por padrão, o áudio deve estar habilitado (true)
  useEffect(() => {
    const savedAudio = localStorage.getItem('audioEnabled');
    if (savedAudio !== null) {
      setAudioEnabled(JSON.parse(savedAudio));
    } else {
      setAudioEnabled(true);
      localStorage.setItem('audioEnabled', 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('audioEnabled', JSON.stringify(audioEnabled));
  }, [audioEnabled]);

  // Destravar áudio/speech na primeira interação do usuário
  const unlockAudioOnce = useCallback(() => {
    if (audioUnlockedRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current as AudioContext;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // Gerar um som inaudível para desbloquear o contexto de áudio
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          osc.frequency.value = 440;
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.01);
        } catch {}
      }
      // "Aquecer" o speechSynthesis com uma utterance silenciosa
      if (window.speechSynthesis) {
        try {
          const u = new SpeechSynthesisUtterance(' ');
          u.lang = 'pt-BR';
          u.volume = 0;
          window.speechSynthesis.speak(u);
        } catch {}
      }
      audioUnlockedRef.current = true;
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => unlockAudioOnce();
    window.addEventListener('pointerdown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
    };
  }, [unlockAudioOnce]);

  useEffect(() => {
    if (audioEnabled) {
      unlockAudioOnce();
    }
  }, [audioEnabled, unlockAudioOnce]);

  const beep = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const audioContext = audioCtxRef.current as AudioContext;
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {}
  }, [audioEnabled]);

  // Função para processar a fila de anúncios - otimizada
  const processarFilaAnuncios = useCallback(() => {
    if (anunciandoAtualmente || filaAnuncios.length === 0) return;

    const proximoAnuncio = filaAnuncios[0];
    setAnunciandoAtualmente(true);

    if (proximoAnuncio.tipo === 'senha') {
      executarAnuncioSenha(proximoAnuncio.dados);
    } else if (proximoAnuncio.tipo === 'grupo') {
      executarAnuncioGrupo(proximoAnuncio.dados);
    }
  }, [anunciandoAtualmente, filaAnuncios.length]); // Otimizado: apenas length ao invés do array completo

  // Executar anúncio individual
  const executarAnuncioSenha = useCallback((senha: Senha) => {
    if (!audioEnabled || !window.speechSynthesis) {
      finalizarAnuncio();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      

      const codigo = getCodigoComposto(senha);
      const textoBase = `Senha ${codigo}`;
      const texto = senha.guiche ? `${textoBase}, dirigir-se ao guichê ${senha.guiche}. Repito: Senha ${codigo}, guichê ${senha.guiche}.` : `${textoBase}.`;
      
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "pt-BR";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.onend = () => {
        finalizarAnuncio();
      };
      utterance.onerror = () => {
        finalizarAnuncio();
      };
      
      beep();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      finalizarAnuncio();
    }
  }, [audioEnabled, voice, getCodigoComposto, beep]);

  // Executar anúncio de grupo
  const executarAnuncioGrupo = useCallback((senhas: Senha[]) => {
    if (!audioEnabled || !window.speechSynthesis) {
      finalizarAnuncio();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      const numeros = senhas.map((s) => getCodigoComposto(s));
      const guichesUnicos = Array.from(new Set(senhas.map(s => s.guiche).filter(Boolean))) as (string | number)[];
      const fraseGuiches = guichesUnicos.length
        ? (guichesUnicos.length === 1
            ? ` Encaminhar ao guichê ${guichesUnicos[0]}.`
            : ` Encaminhar aos guichês ${guichesUnicos.join(', ')}.`)
        : '';
      const texto = `Chamando as senhas ${numeros.join(', ')}.${fraseGuiches} Repito: ${numeros.join(', ')}.${fraseGuiches}`;
      
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = "pt-BR";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      if (voice) utterance.voice = voice;
      
      utterance.onend = () => {
        finalizarAnuncio();
      };
      utterance.onerror = () => {
        finalizarAnuncio();
      };
      
      beep();
      window.speechSynthesis.speak(utterance);
    } catch (error: unknown) {
      finalizarAnuncio();
    }
  }, [audioEnabled, voice, getCodigoComposto, beep]);

  // Finalizar anúncio atual e processar próximo - otimizada
  const finalizarAnuncio = useCallback(() => {
    setAnunciandoAtualmente(false);
    setFilaAnuncios(prev => prev.slice(1));
  }, []);

  // Adicionar anúncio à fila - com tipos específicos
  const adicionarAnuncioFila = useCallback((item: AnuncioItem) => {
    setFilaAnuncios(prev => [...prev, item]);
  }, []);

  // Processar fila quando houver mudanças - otimizado
  useEffect(() => {
    if (!anunciandoAtualmente && filaAnuncios.length > 0) {
      processarFilaAnuncios();
    }
  }, [filaAnuncios.length, anunciandoAtualmente, processarFilaAnuncios]);


  // Funções públicas que agora usam a fila - otimizadas
  const anunciarSenha = useCallback((senha: Senha) => {
    adicionarAnuncioFila({ tipo: 'senha', dados: senha });
  }, [adicionarAnuncioFila]);

  const anunciarGrupo = useCallback((senhas: Senha[]) => {
    adicionarAnuncioFila({ tipo: 'grupo', dados: senhas });
  }, [adicionarAnuncioFila]);

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('senhas')
        .select('*')
        .order('updated_at', { ascending: true });

      if (error) throw error;

      const agoraMs = Date.now();
      const cincoMinMs = 5 * 60 * 1000;
      const tresMinMs = 3 * 60 * 1000; // 3 minutos para senhas chamando

      // Filtrar senhas chamando que não passaram de 3 minutos
      const chamandoAtual = data?.filter(s => {
        if (s.status !== 'chamando') return false;
        if (!s.hora_chamada) return true; // Se não tem hora_chamada, mantém
        const chamadaMs = new Date(s.hora_chamada).getTime();
        return (agoraMs - chamadaMs) <= tresMinMs;
      }) || [];

      const aguardando = data?.filter(s => s.status === 'aguardando') || [];
      
      const finalizadasRecentes = data?.filter(s => {
        if (!s.hora_chamada) return false;
        const chamadaMs = new Date(s.hora_chamada).getTime();
        return s.status === 'atendida' && (agoraMs - chamadaMs) <= cincoMinMs;
      }) || [];

      // Detectar novas senhas chamando
      const newIds = chamandoAtual.map(s => s.id).sort();
      const prevIds = prevIdsRef.current;
      const hasNew = newIds.some(id => !prevIds.has(id));

      setChamando(chamandoAtual);
      setProximas(aguardando.slice(0, 8));
      setFinalizadas(finalizadasRecentes);

      // Atualizar tempos
      const novosTempos: Record<string, string> = {};
      [...chamandoAtual, ...aguardando, ...finalizadasRecentes].forEach(s => {
        novosTempos[s.id] = formatTempo(s.hora_retirada);
      });
      setTempos(novosTempos);

      // Anunciar novas senhas (incluindo a primeira)
      if (hasNew && audioEnabled) {
        // Aguardar um pouco para garantir que as vozes estejam carregadas
        setTimeout(() => {
          unlockAudioOnce();
          beep();
          const novos = chamandoAtual.filter(s => !prevIds.has(s.id));
          
          if (novos.length > 1) {
            anunciarGrupo(novos);
          } else if (novos.length === 1) {
            anunciarSenha(novos[0]);
          }
        }, 500); // Delay de 500ms para garantir que tudo esteja pronto
      }

      // Atualizar referência dos IDs anteriores
      prevIdsRef.current = new Set(newIds);
    } catch (e) {
      console.error("Erro ao carregar:", e);
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (!window.speechSynthesis) {
      console.log('SpeechSynthesis não disponível neste navegador');
      return;
    }

    const chooseVoice = (voices: SpeechSynthesisVoice[]) => {
      console.log('Vozes disponíveis:', voices.map(v => `${v.name} (${v.lang})`));
      
      const pt = voices.filter(v => v.lang?.toLowerCase().startsWith('pt'));
      const ptBr = voices.filter(v => v.lang?.toLowerCase().startsWith('pt-br'));
      
      console.log('Vozes PT-BR:', ptBr.map(v => v.name));
      console.log('Vozes PT:', pt.map(v => v.name));
      
      const preferredName = localStorage.getItem('preferredVoiceName') || '';
      const byPreferred = preferredName ? [...ptBr, ...pt].find(v => v.name === preferredName) || null : null;

      // Priorizar vozes femininas
      const femaleVoices = [...ptBr, ...pt].filter(v => 
        /(female|mulher|ana|maria|raquel|lu[cç]iana|camila|bruna|paula|helena|sofia|clara|beatriz|fernanda|carolina|isabela|gabriela|amanda|juliana|leticia|natalia|patricia|roberta|sandra|silvia|tatiana|vanessa|viviane)/i.test(v.name) ||
        v.name.toLowerCase().includes('female') ||
        (!v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('masculin'))
      );
      
      const googlePtBr = ptBr.find(v => /google/i.test(v.name));
      const googleFemale = femaleVoices.find(v => /google/i.test(v.name));
      
      // Ordem de preferência: preferida anterior > Google feminina > Microsoft Maria > qualquer feminina > Google PT-BR > primeira PT-BR > primeira PT
      const microsoftMaria = [...ptBr, ...pt].find(v => /maria/i.test(v.name) && /microsoft/i.test(v.name)) || null;
      const selectedVoice = byPreferred || googleFemale || microsoftMaria || femaleVoices[0] || googlePtBr || ptBr[0] || pt[0] || voices[0] || null;
      
      console.log('Voz selecionada:', selectedVoice?.name || 'Nenhuma');
      setVoice(selectedVoice);
      if (selectedVoice?.name) {
        localStorage.setItem('preferredVoiceName', selectedVoice.name);
      }
    };

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        chooseVoice(voices);
      } else {
        console.log('Aguardando carregamento das vozes...');
      }
    };
    
    // Carregar vozes imediatamente
    loadVoices();
    
    // E também quando o evento disparar
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 1000); // Atualiza a cada 1s para cronômetro
    const channel = supabase
      .channel('painel-senhas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'senhas' }, () => {
        carregar();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [carregar]);

  function getPrefixo(tipo: string) {
    const t = normalizeTipo(tipo);
    switch (t) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      case "express": return "E";
      default: return "N";
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background imagem opcional */}
      {import.meta.env.VITE_BACKGROUND_IMAGE_URL && (
        <div className="absolute inset-0 bg-cover bg-center bg-custom-bg" />
      )}

      {/* Vídeo de fundo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <iframe
          title="Vídeo de fundo do painel de chamadas"
          className="absolute top-1/2 left-1/2 w-[177.77777778vh] h-[56.25vw] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
          src="https://www.youtube.com/embed/_TUU487uR38?autoplay=1&mute=1&loop=1&playlist=_TUU487uR38&start=35&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
          allow="autoplay; encrypted-media"
          frameBorder="0"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 min-h-screen flex">
        {/* Coluna Esquerda - Informações */}
        <div className="w-full md:w-1/2 p-6 space-y-4 overflow-hidden">
          {/* Header com botão discreto e logo */}
          <div className="flex justify-between items-start">
            <div>
              {import.meta.env.VITE_LOGO_URL && (
                <img src={import.meta.env.VITE_LOGO_URL} alt="Logo" className="h-10 mb-2" />
              )}
              <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg">Painel de Chamadas</h1>
            </div>
            <Button
              onClick={() => setAudioEnabled(!audioEnabled)}
              variant="ghost"
              size="sm"
              className="bg-black/30 hover:bg-black/50 text-white border-white/20 backdrop-blur-sm"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>

          {/* Senhas Chamando Agora */}
          <Card className="bg-black/60 backdrop-blur-md border-destructive/50 shadow-elevated">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 blink-red">Senhas Chamando Agora</h2>
              {chamando.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {chamando.map((senha) => (
                    <div key={senha.id} className="bg-destructive/20 border-2 border-destructive rounded-xl p-4 pulse-glow">
                      <div className="flex justify-between items-center">
                        <div className="min-w-0 flex-1">
                          <div className="text-2xl font-bold text-white mb-1">
                            {getCodigoComposto(senha)}
                          </div>
                          <div className="text-lg font-semibold text-white truncate">Guichê {senha.guiche}</div>
                          <div className="text-sm text-white/80 break-words">{senha.atendente_nome}</div>
                        </div>
                        <div className="text-right ml-2 flex-shrink-0 min-w-0">
                          <div className="text-sm font-mono text-white/90 truncate">{tempos[senha.id]}</div>
                          <div className="text-xs text-white/70">tempo</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg text-white/70">Aguardando chamadas...</p>
                </div>
              )}
            </div>
          </Card>

          {/* Próximas Senhas */}
          <Card className="bg-black/50 backdrop-blur-md border-white/20 shadow-elevated">
            <div className="p-4">
              <h2 className="text-xl font-bold mb-3 text-white">Próximas Senhas</h2>
              {proximas.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {proximas.map((senha) => (
                    <div key={senha.id} className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                      <div className="text-xl font-bold text-white mb-1">
                        {getCodigoComposto(senha)}
                      </div>
                      <div className="text-xs font-mono text-white/70">{tempos[senha.id]}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-white/60">Nenhuma senha aguardando</p>
                </div>
              )}
            </div>
          </Card>

          {/* Senhas Chamadas */}
          <Card className="bg-black/50 backdrop-blur-md border-white/20 shadow-elevated">
            <div className="p-4">
              <h2 className="text-xl font-bold mb-3 text-white">Senhas Chamadas</h2>
              {finalizadas.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {finalizadas.map((senha) => (
                    <div key={senha.id} className="bg-success/20 border border-success/30 rounded-lg p-3 text-center backdrop-blur-sm">
                      <div className="text-xl font-bold text-white mb-1">
                        {getPrefixo(senha.tipo)}{String(senha.numero).padStart(3, "0")}
                      </div>
                      <div className="text-xs font-mono text-white/70">{tempos[senha.id]}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-white/60">Nenhuma senha finalizada</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
function getCodigoComposto(s: Senha) {
  const num = String(s.numero).padStart(4, '0');
  const obs = String((s as any).observacoes || '').toLowerCase();
  const isPrioritario = /prioritario/i.test(obs) || normalizeTipo(s.tipo) === 'preferencial';

  if (normalizeTipo(s.tipo) === 'check-out') {
    const code = isPrioritario ? 'COXP' : 'COXC';
    return `${code}-${num}`;
  }

  if (/checkin:express/i.test(obs)) {
    const code = isPrioritario ? 'CIEP' : 'CIEC';
    return `${code}-${num}`;
  }
  if (/checkin:normal/i.test(obs)) {
    const code = isPrioritario ? 'CINP' : 'CINC';
    return `${code}-${num}`;
  }
  if (/checkin:proprietario/i.test(obs) || normalizeTipo(s.tipo) === 'proprietario') {
    const code = isPrioritario ? 'CIPP' : 'CIPC';
    return `${code}-${num}`;
  }

  // Atendimento padrão
  const code = isPrioritario ? 'ATNP' : 'ATNC';
  return `${code}-${num}`;
}

