import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Download, RefreshCw, FileSpreadsheet } from "lucide-react";
import XLSX from "xlsx-js-style";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SenhaStatus = "aguardando" | "chamando" | "atendida" | "cancelada";
type SenhaTipo = "normal" | "preferencial" | "proprietario" | "check-in" | "check-out" | "express";
interface Senha {
  id: string;
  numero: number;
  tipo: SenhaTipo;
  status: SenhaStatus;
  hora_retirada: string;
  hora_chamada: string | null;
  hora_atendimento: string | null;
  guiche: string | null;
  atendente: string | null;
  numero_apartamento?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function Relatorios() {
  const [senhas, setSenhas] = useState<Senha[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("hoje");
  // Filtros adicionais
  const [selectedStatuses, setSelectedStatuses] = useState<SenhaStatus[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<SenhaTipo[]>([]);
  const [atendenteFilter, setAtendenteFilter] = useState("");
  const [guicheFilter, setGuicheFilter] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  // Opções
  const STATUS_OPTIONS: SenhaStatus[] = ["aguardando", "chamando", "atendida", "cancelada"];
  const TIPO_OPTIONS: SenhaTipo[] = ["normal", "preferencial", "proprietario", "check-in", "check-out", "express"];
  const { toast } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('senhas')
        .select('*')
        .order('hora_retirada', { ascending: false });

      if (periodo === "hoje" && !fromDate && !toDate) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        query = query.gte('hora_retirada', hoje.toISOString());
      }

      // Filtros avançados
      if (selectedStatuses.length > 0) {
        query = query.in('status', selectedStatuses);
      }
      if (selectedTipos.length > 0) {
        query = query.in('tipo', selectedTipos);
      }
      if (atendenteFilter.trim()) {
        query = query.ilike('atendente', `%${atendenteFilter}%`);
      }
      if (guicheFilter.trim()) {
        query = query.ilike('guiche', `%${guicheFilter}%`);
      }
      if (fromDate) {
        const iso = new Date(fromDate).toISOString();
        query = query.gte('hora_retirada', iso);
      }
      if (toDate) {
        const iso = new Date(toDate).toISOString();
        query = query.lte('hora_retirada', iso);
      }

      const { data, error } = await query.limit(2000);

      if (error) throw error;

      const rows = (data || []) as any[];

      const extractApartamento = (obs?: string | null): string | null => {
        if (!obs) return null;
        // Tenta formatos comuns: "Apartamento 123", "Apto 123", "apto:123"
        const m = obs.match(/(?:apartamento|apto)\s*[:#-]?\s*(\d{1,6})/i);
        return m ? m[1] : null;
      };

      const normalizadas: Senha[] = rows.map((r) => ({
        id: r.id,
        numero: r.numero,
        tipo: r.tipo as SenhaTipo,
        status: r.status as SenhaStatus,
        hora_retirada: r.hora_retirada,
        hora_chamada: r.hora_chamada,
        hora_atendimento: r.hora_atendimento,
        guiche: r.guiche,
        // Usa o melhor campo disponível para 'atendente'
        atendente: (r.atendente ?? r.atendente_nome ?? r.usuario_nome ?? null) as string | null,
        numero_apartamento: ((r.numero_apartamento ?? null) as string | null) ?? extractApartamento(r.observacoes),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      setSenhas(normalizadas);
    } catch (e: unknown) {
      toast({
        title: "Erro ao carregar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [periodo, selectedStatuses, selectedTipos, atendenteFilter, guicheFilter, fromDate, toDate, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function getPrefixo(tipo: string) {
    switch (tipo) {
      case "preferencial": return "P";
      case "proprietario": return "PR";
      case "check-in": return "CI";
      case "check-out": return "CO";
      case "express": return "E";
      default: return "N";
    }
  }
  const numero = (s: Senha) => `${getPrefixo(s.tipo)}${String(s.numero).padStart(3, "0")}`;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "-";

  // Helpers para nomes e cores
  const tipoNome = (tipo: string) => {
    switch (tipo) {
      case "preferencial": return "Preferencial";
      case "proprietario": return "Proprietário";
      case "check-in": return "Check-in";
      case "check-out": return "Check-out";
      case "express": return "Express";
      default: return "Normal";
    }
  };

  const TYPE_COLORS: Record<string, string> = {
    preferencial: "#ef4444",
    proprietario: "#f59e0b",
    "check-in": "#10b981",
    "check-out": "#3b82f6",
    express: "#a855f7",
    normal: "#6b7280",
  };

  // Dados do gráfico de pizza por tipo
  const pieData = Object.entries(
    senhas.reduce<Record<string, number>>((acc, s) => {
      const key = s.tipo || "normal";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([tipo, value]) => ({ name: tipoNome(tipo), value, tipo }));

  // Ranking dos atendentes por atendimentos concluídos
  const rankingAtendentes = Object.entries(
    senhas
      .filter((s) => s.status === "atendida" && s.atendente)
      .reduce<Record<string, number>>((acc, s) => {
        const nome = s.atendente as string;
        acc[nome] = (acc[nome] || 0) + 1;
        return acc;
      }, {})
  )
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  function exportarCSV() {
    if (!senhas.length) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const sep = ";";
    const header = `sep=${sep}\r\nNumero;Tipo;Status;Retirada;Chamada;Atendimento;Guiche;Atendente;Apartamento`;
    const rows = senhas.map(s => {
      const numeroText = `="${numero(s)}"`;
      const cols = [
        numeroText,
        s.tipo,
        s.status,
        fmt(s.hora_retirada),
        fmt(s.hora_chamada),
        fmt(s.hora_atendimento),
        s.guiche || "",
        s.atendente || "",
        s.numero_apartamento || "",
      ];
      return cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep);
    });
    const csv = [header, ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportado!",
      description: "Arquivo CSV baixado com sucesso.",
    });
  }

  function exportarXLSX() {
    if (!senhas.length) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const header = [
      "Numero",
      "Tipo",
      "Status",
      "Retirada",
      "Chamada",
      "Atendimento",
      "Guiche",
      "Atendente",
      "Apartamento",
    ];

    const tipoNome = (tipo: string) => {
      switch (tipo) {
        case "preferencial": return "Preferencial";
        case "proprietario": return "Proprietário";
        case "check-in": return "Check-in";
        case "check-out": return "Check-out";
        case "express": return "Express";
        default: return "Normal";
      }
    };

    const rows = senhas.map((s) => [
      `${numero(s)}`,
      tipoNome(s.tipo),
      s.status,
      fmt(s.hora_retirada),
      fmt(s.hora_chamada),
      fmt(s.hora_atendimento),
      s.guiche || "",
      s.atendente || "",
      s.numero_apartamento || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "1E3A8A" } },
      alignment: { horizontal: "center" as const, vertical: "center" as const },
    };

    const colWidths = [8, 14, 12, 19, 19, 19, 10, 18, 12];
    ws["!cols"] = colWidths.map((wch) => ({ wch }));

    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      (ws as XLSX.WorkSheet)[cellAddress].s = headerStyle;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `relatorio-${periodo}.xlsx`);

    toast({ title: "Exportado!", description: "Arquivo XLSX baixado com sucesso." });
  }

  // Helpers UI para filtros
  const toggleStatus = (status: SenhaStatus, checked: boolean) => {
    setSelectedStatuses((prev) => {
      const set = new Set(prev);
      if (checked) set.add(status); else set.delete(status);
      return Array.from(set);
    });
  };
  const toggleTipo = (tipo: SenhaTipo, checked: boolean) => {
    setSelectedTipos((prev) => {
      const set = new Set(prev);
      if (checked) set.add(tipo); else set.delete(tipo);
      return Array.from(set);
    });
  };
  const limparFiltros = () => {
    setSelectedStatuses([]);
    setSelectedTipos([]);
    setAtendenteFilter("");
    setGuicheFilter("");
    setFromDate("");
    setToDate("");
    setPeriodo("hoje");
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">        {pieData.length > 0 ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Resumo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={120} isAnimationActive={false} label={false} labelLine={false}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.tipo] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Resumo por tipo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pieData.sort((a,b)=>b.value-a.value).map((row) => (
                        <tr key={row.tipo} className="border-b">
                          <td className="p-2 flex items-center gap-2">
                            <span className={`inline-block w-3 h-3 rounded bg-${row.tipo}`} />
                            {row.name}
                          </td>
                          <td className="p-2 text-right font-mono">{row.value}</td>
                          <td className="p-2 text-right font-mono">{((row.value / (senhas.length||1)) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                      {pieData.length === 0 && (
                        <tr><td className="p-2 text-muted-foreground" colSpan={3}>Sem dados no período</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h3 className="font-semibold mt-6 mb-2">Ranking de atendentes (atendidas)</h3>
                <ol className="space-y-2">
                  {rankingAtendentes.map((r, i) => (
                    <li key={r.nome} className="flex justify-between border-b pb-1">
                      <span className="text-sm">{i + 1}. {r.nome}</span>
                      <span className="text-sm font-mono">{r.count}</span>
                    </li>
                  ))}
                  {rankingAtendentes.length === 0 && (
                    <li className="text-muted-foreground">Nenhum atendimento concluído no período.</li>
                  )}
                </ol>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="todos">Todos (limite 2000)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={carregar} variant="outline" disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button onClick={limparFiltros} variant="ghost">Limpar filtros</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportarCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              <Button onClick={exportarXLSX}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar XLSX
              </Button>
            </div>
          </div>
        </Card>

        {/* Filtros avançados */}
        <Card className="p-6">
          <div className="mt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>De</Label>
              <Input type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Até</Label>
              <Input type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Atendente</Label>
              <Input placeholder="Filtrar por atendente" value={atendenteFilter} onChange={(e) => setAtendenteFilter(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Guichê</Label>
              <Input placeholder="Filtrar por guichê" value={guicheFilter} onChange={(e) => setGuicheFilter(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-3">
                {STATUS_OPTIONS.map((st) => (
                  <label key={st} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedStatuses.includes(st)} onCheckedChange={(checked) => toggleStatus(st, !!checked)} />
                    {st}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-3">
                {TIPO_OPTIONS.map((tp) => (
                  <label key={tp} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedTipos.includes(tp)} onCheckedChange={(checked) => toggleTipo(tp, !!checked)} />
                    {tp}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Senhas ({senhas.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Número</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Retirada</th>
                  <th className="text-left p-3">Chamada</th>
                  <th className="text-left p-3">Atendimento</th>
                  <th className="text-left p-3">Guichê</th>
                  <th className="text-left p-3">Atendente</th>
                </tr>
              </thead>
              <tbody>
                {senhas.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-mono font-bold">{numero(s)}</td>
                    <td className="p-3">{s.tipo}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        s.status === 'aguardando' ? 'bg-warning/10 text-warning' :
                        s.status === 'chamando' ? 'bg-primary/10 text-primary' :
                        s.status === 'atendida' ? 'bg-success/10 text-success' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{fmt(s.hora_retirada)}</td>
                    <td className="p-3 text-sm">{fmt(s.hora_chamada)}</td>
                    <td className="p-3 text-sm">{fmt(s.hora_atendimento)}</td>
                    <td className="p-3">{s.guiche || "-"}</td>
                    <td className="p-3">{s.atendente || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {senhas.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma senha encontrada
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}