/* eslint-disable react-refresh/only-export-components */
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface SenhaCardProps {
  senha: {
    id: string;
    numero: number;
    tipo: string;
    status: string;
    guiche?: string;
    atendente?: string;
    hora_retirada: string;
    observacoes?: string;
  };
}

export default function SenhaCard({ senha }: SenhaCardProps) {
  const getPrefixo = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      case "hospede": return "H";
      case "express": return "E";
      default: return "N";
    }
  };

  const getTipoNomeBase = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "Prioritário";
      case "proprietario": return "Proprietário";
      case "check-in": return "Check-in";
      case "check-out": return "Check-out";
      case "hospede": return "Hóspede";
      case "express": return "Express";
      default: return "Comum";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aguardando": return "bg-warning/10 text-warning border-warning/20";
      case "chamando": return "bg-primary/10 text-primary border-primary/20";
      case "atendida": return "bg-success/10 text-success border-success/20";
      case "cancelada": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTipoNomeCompostoFromObs = () => {
    const obs = String(senha.observacoes || '').toLowerCase();

    // Extrair composição do check-in
    const checkinMatch = obs.match(/checkin:(express|normal|proprietario)/i);
    const prioridadeMatch = obs.match(/prioridade:(prioritario|comum)/i);

    const checkinTipo = checkinMatch?.[1] as 'express' | 'normal' | 'proprietario' | undefined;
    const prioridadeNivel = (prioridadeMatch?.[1] as 'prioritario' | 'comum' | undefined) || (senha.tipo === 'preferencial' ? 'prioritario' : undefined);

    if (checkinTipo) {
      if (checkinTipo === 'proprietario') {
        return prioridadeNivel === 'prioritario'
          ? 'Proprietário - Prioritário'
           : 'Proprietário - Comum';
      }
      if (checkinTipo === 'express') {
        return prioridadeNivel === 'prioritario'
          ? 'Express - Prioritário'
          : 'Express - Comum';
      }
      // normal
      return prioridadeNivel === 'prioritario'
        ? 'Normal - Prioritário'
        : 'Normal - Comum';
    }

    // Atendimento padrão e check-out mantêm nomenclaturas próprias
    if (senha.tipo === 'check-out') {
      return prioridadeNivel === 'prioritario' ? 'Check-out – Prioritário' : 'Check-out – Comum';
    }
    if (senha.tipo === 'preferencial') {
      return 'Atendimento – Prioritário';
    }
    if (senha.tipo === 'normal') {
      return 'Atendimento – Comum';
    }
    return getTipoNomeBase(senha.tipo);
  };

  const normalizeTipo = (tipo: string) => tipo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const getCodigoComposto = (s: { tipo: string; numero: number; observacoes?: string }) => {
    const num = String(s.numero).padStart(4, '0');
    const obs = String(s.observacoes ?? '').toLowerCase();
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
      const code = isPrioritario ? 'CINP' : 'CIEN';
      return `${code}-${num}`;
    }
    if (/checkin:proprietario/i.test(obs) || normalizeTipo(s.tipo) === 'proprietario') {
      const code = isPrioritario ? 'CIPP' : 'CIPC';
      return `${code}-${num}`;
    }

    // Atendimento padrão
    const code = isPrioritario ? 'ATNP' : 'ATNC';
    return `${code}-${num}`;
  };
  const numero = getCodigoComposto(senha);
  const statusTexto = senha.status.charAt(0).toUpperCase() + senha.status.slice(1);

  return (
    <Card className="p-4 hover:shadow-elevated transition-smooth">
      <div className="flex items-center justify-between mb-3">
        <div className="text-3xl font-bold text-primary">{numero}</div>
        <Badge className={`${getStatusColor(senha.status)} font-medium`}>
          {statusTexto}
        </Badge>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">
          Tipo: <span className="text-foreground font-medium">{getTipoNomeCompostoFromObs()}</span>
        </div>
        {senha.guiche && (
          <div className="text-muted-foreground">
            Guichê: <span className="text-foreground font-medium">{senha.guiche}</span>
          </div>
        )}
        {senha.atendente && (
          <div className="text-muted-foreground">
            Atendente: <span className="text-foreground font-medium">{senha.atendente}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

export function getTipoNomeCompostoFromObs(tipo: string, obs: string): string {
  const t = tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const o = obs.toLowerCase();
  const isPrioritario = /prioritario/i.test(o) || t === 'preferencial' || /efnrh:sim/i.test(o);

  if (t === 'check-out') {
    return isPrioritario ? 'Check-out – Prioritário' : 'Check-out – Comum';
  }
  if (/checkin:express/i.test(o) || t === 'express') {
    return isPrioritario ? 'Express - Prioritário' : 'Express - Comum';
  }
  if (/checkin:normal/i.test(o) || t === 'check-in') {
    return isPrioritario ? 'Normal - Prioritário' : 'Normal - Comum';
  }
  if (/checkin:proprietario/i.test(o) || t === 'proprietario') {
    return isPrioritario ? 'Proprietário - Prioritário' : 'Proprietário - Comum';
  }
  return isPrioritario ? 'Atendimento – Prioritário' : 'Atendimento – Comum';
}
