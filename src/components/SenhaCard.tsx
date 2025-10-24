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

  const getTipoNome = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "Preferencial";
      case "proprietario": return "Proprietário";
      case "check-in": return "Check-in";
      case "check-out": return "Check-out";
      case "hospede": return "Hóspede";
      case "express": return "Express";
      default: return "Normal";
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

  const numero = `${getPrefixo(senha.tipo)}${String(senha.numero).padStart(3, "0")}`;
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
          Tipo: <span className="text-foreground font-medium">{getTipoNome(senha.tipo)}</span>
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
