import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Download, RefreshCw, FileSpreadsheet, Calendar, TrendingUp, LogIn } from "lucide-react";
import XLSX from "xlsx-js-style";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiService } from "@/lib/api";

type ReportType = "daily" | "monthly" | "export" | "performance";

// Importar interfaces do api.ts
interface SenhaData {
  id: string;
  numero: number;
  prefixo?: string;
  senha_completa?: string;
  tipo: 'normal' | 'prioritario' | 'hospede' | 'preferencial' | 'proprietario' | 'check-in' | 'check-out';
  status: 'aguardando' | 'chamando' | 'chamada' | 'atendida' | 'cancelada' | 'expirada';
  usuario_id?: string;
  usuario_nome?: string;
  user_name?: string;
  atendente_id?: string;
  atendente_nome?: string;
  atendente_name?: string;
  atendente?: string;
  guiche?: string;
  observacoes?: string;
  hora_retirada?: string;
  hora_chamada?: string;
  hora_atendimento?: string;
  chamada_em?: string;
  atendida_em?: string;
  cancelada_em?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  is_expired?: boolean;
}

interface DailyReportData {
  date: string;
  senhas: {
    rows: SenhaData[];
    rowCount: number;
  };
}

interface MonthlyReportData {
  period: {
    year: number;
    month: number;
  };
  summary: {
    totalSenhas: number;
    senhasAtendidas: number;
    tempoMedioAtendimento: number;
  };
  daily: Array<{
    date: string;
    totalSenhas: number;
    senhasAtendidas: number;
    senhasNormais: number;
    senhasPrioritarias: number;
    senhasHospedes: number;
    tempoMedioAtendimento: number;
  }>;
}

interface PerformanceData {
  id: string;
  numero: number;
  tipo: string;
  status: string;
  tempo_atendimento?: number;
  atendente_nome?: string;
  guiche?: string;
  created_at: string;
  atendida_em?: string;
}

interface PerformanceReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  performance: {
    rows: PerformanceData[];
    rowCount: number;
  };
}

interface ExportData {
  id: string;
  numero: number;
  prefixo?: string;
  senha_completa?: string;
  tipo: string;
  status: string;
  usuario_nome?: string;
  atendente_nome?: string;
  guiche?: string;
  hora_retirada?: string;
  hora_chamada?: string;
  hora_atendimento?: string;
  created_at: string;
  updated_at: string;
}

export default function RelatoriosBackend() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Report data states
  const [dailyData, setDailyData] = useState<DailyReportData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [exportData, setExportData] = useState<ExportData[] | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceReportData | null>(null);

  const { toast } = useToast();

  // Check authentication on component mount
  useEffect(() => {
    setIsAuthenticated(apiService.isAuthenticated());
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const response = await apiService.login({
        email: loginEmail,
        senha: loginPassword,
      });

      if (response.success) {
        setIsAuthenticated(true);
        toast({
          title: "Login realizado com sucesso",
          description: "Agora você pode acessar os relatórios",
        });
      } else {
        throw new Error(response.message || 'Erro ao fazer login');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao fazer login",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setDailyData(null);
    setMonthlyData(null);
    setExportData(null);
    setPerformanceData(null);
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado",
    });
  };

  const loadDailyReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getDailyReport(selectedDate);
      if (response.success && response.data) {
        setDailyData(response.data);
      } else {
        throw new Error(response.message || 'Erro ao carregar relatório diário');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao carregar relatório diário",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

  const loadMonthlyReport = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const response = await apiService.getMonthlyReport(year, month);
      if (response.success && response.data) {
        setMonthlyData(response.data);
      } else {
        throw new Error(response.message || 'Erro ao carregar relatório mensal');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao carregar relatório mensal",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, toast]);

  const loadExportReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getExportReport(startDate, endDate);
      if (response.success && response.data) {
        setExportData(response.data);
      } else {
        throw new Error(response.message || 'Erro ao carregar dados para exportação');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao carregar dados para exportação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  const loadPerformanceReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getPerformanceReport(startDate, endDate);
      if (response.success && response.data) {
        setPerformanceData(response.data);
      } else {
        throw new Error(response.message || 'Erro ao carregar relatório de performance');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao carregar relatório de performance",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  const loadCurrentReport = useCallback(() => {
    switch (reportType) {
      case "daily":
        loadDailyReport();
        break;
      case "monthly":
        loadMonthlyReport();
        break;
      case "export":
        loadExportReport();
        break;
      case "performance":
        loadPerformanceReport();
        break;
    }
  }, [reportType, loadDailyReport, loadMonthlyReport, loadExportReport, loadPerformanceReport]);

  useEffect(() => {
    if (apiService.isAuthenticated()) {
      loadCurrentReport();
    } else {
      toast({
        title: "Não autenticado",
        description: "Faça login para acessar os relatórios",
        variant: "destructive",
      });
    }
  }, [loadCurrentReport, toast]);

  const exportToCSV = () => {
    if (!exportData || exportData.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar.",
        variant: "destructive",
      });
      return;
    }

    const sep = ";";
    const header = `sep=${sep}\r\nNumero;Tipo;Status;Retirada;Chamada;Atendimento;Guiche;Atendente`;
    const rows = exportData.map(item => {
      const cols = [
        item.numero || "",
        item.tipo || "",
        item.status || "",
        item.hora_retirada || "",
        item.hora_chamada || "",
        item.hora_atendimento || "",
        item.guiche || "",
        item.atendente_nome || ""
      ];
      return cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep);
    });
    const csv = [header, ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exportado!",
      description: "Arquivo CSV baixado com sucesso.",
    });
  };

  const exportToXLSX = () => {
    if (!exportData || exportData.length === 0) {
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
    ];

    const rows = exportData.map((item) => [
      item.numero || "",
      item.tipo || "",
      item.status || "",
      item.hora_retirada || "",
      item.hora_chamada || "",
      item.hora_atendimento || "",
      item.guiche || "",
      item.atendente_nome || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "1E3A8A" } },
      alignment: { horizontal: "center" as const, vertical: "center" as const },
    };

    const colWidths = [8, 14, 12, 19, 19, 19, 10, 18];
    ws["!cols"] = colWidths.map((wch) => ({ wch }));

    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      (ws as XLSX.WorkSheet)[cellAddress].s = headerStyle;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `relatorio-${startDate}-${endDate}.xlsx`);

    toast({ title: "Exportado!", description: "Arquivo XLSX baixado com sucesso." });
  };

  const renderDailyReport = () => {
    if (!dailyData) return null;

    const senhas = dailyData.senhas.rows;
    const totalSenhas = dailyData.senhas.rowCount;

    // Group by type for pie chart
    const typeGroups = senhas.reduce((acc: Record<string, number>, senha: SenhaData) => {
      const tipo = senha.tipo || 'normal';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});

    const pieData = Object.entries(typeGroups).map(([tipo, count]) => ({
      name: tipo,
      value: count,
      tipo
    }));

    const TYPE_COLORS: Record<string, string> = {
      normal: "#6b7280",
      prioritario: "#ef4444",
      hospede: "#a855f7",
    };

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Relatório Diário - {dailyData.date}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Total de Senhas: {totalSenhas}</h4>
              {pieData.length > 0 && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        dataKey="value" 
                        nameKey="name" 
                        outerRadius={80} 
                        isAnimationActive={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.tipo] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2">Resumo por Tipo</h4>
              <div className="space-y-2">
                {Object.entries(typeGroups).map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between">
                    <span className="capitalize">{tipo}:</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderMonthlyReport = () => {
    if (!monthlyData) return null;

    const chartData = monthlyData.daily.map(day => ({
      date: new Date(day.date).getDate(),
      total: day.totalSenhas,
      atendidas: day.senhasAtendidas,
      tempo: day.tempoMedioAtendimento
    }));

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Relatório Mensal - {monthlyData.period.month}/{monthlyData.period.year}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{monthlyData.summary.totalSenhas}</div>
              <div className="text-sm text-blue-600">Total de Senhas</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{monthlyData.summary.senhasAtendidas}</div>
              <div className="text-sm text-green-600">Senhas Atendidas</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {monthlyData.summary.tempoMedioAtendimento.toFixed(1)}s
              </div>
              <div className="text-sm text-purple-600">Tempo Médio</div>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" />
                <Line type="monotone" dataKey="atendidas" stroke="#10b981" name="Atendidas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    );
  };

  const renderPerformanceReport = () => {
    if (!performanceData) return null;

    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Relatório de Performance - {performanceData.period.startDate} a {performanceData.period.endDate}
        </h3>
        <div className="text-center py-8">
          <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {performanceData.performance.rowCount === 0 
              ? "Nenhum dado de performance encontrado para o período selecionado."
              : `${performanceData.performance.rowCount} registros de performance encontrados.`
            }
          </p>
        </div>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Relatórios (Backend)</h1>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                <Button onClick={loadCurrentReport} variant="outline" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button onClick={handleLogout} variant="outline">
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>

        {!isAuthenticated ? (
          <Card className="p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4 text-center">Login Necessário</h2>
            <p className="text-gray-600 mb-6 text-center">
              Faça login para acessar os relatórios do backend
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@costao.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <Button 
                onClick={handleLogin} 
                className="w-full" 
                disabled={loginLoading || !loginEmail || !loginPassword}
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Fazendo login...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Fazer Login
                  </>
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Relatório</Label>
                  <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Diário
                        </div>
                      </SelectItem>
                      <SelectItem value="monthly">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Mensal
                        </div>
                      </SelectItem>
                      <SelectItem value="export">
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Exportação
                        </div>
                      </SelectItem>
                      <SelectItem value="performance">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Performance
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reportType === "daily" && (
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input 
                      type="date" 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)} 
                    />
                  </div>
                )}

                {reportType === "monthly" && (
                  <div className="space-y-2">
                    <Label>Mês/Ano</Label>
                    <Input 
                      type="month" 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(e.target.value)} 
                    />
                  </div>
                )}

                {(reportType === "export" || reportType === "performance") && (
                  <>
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                      />
                    </div>
                  </>
                )}
              </div>

              {reportType === "export" && exportData && (
                <div className="flex items-center gap-2 mt-4">
                  <Button onClick={exportToCSV} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button onClick={exportToXLSX}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Exportar XLSX
                  </Button>
                </div>
              )}
            </Card>

            {loading && (
              <Card className="p-6">
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p>Carregando relatório...</p>
                </div>
              </Card>
            )}

            {!loading && reportType === "daily" && renderDailyReport()}
            {!loading && reportType === "monthly" && renderMonthlyReport()}
            {!loading && reportType === "performance" && renderPerformanceReport()}
            
            {!loading && reportType === "export" && exportData && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Dados para Exportação ({exportData.length} registros)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Número</th>
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Retirada</th>
                        <th className="text-left p-2">Atendente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportData.slice(0, 10).map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 font-mono">{item.numero}</td>
                          <td className="p-2">{item.tipo}</td>
                          <td className="p-2">{item.status}</td>
                          <td className="p-2">{item.hora_retirada}</td>
                          <td className="p-2">{item.atendente_nome || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {exportData.length > 10 && (
                    <p className="text-center text-gray-500 mt-4">
                      ... e mais {exportData.length - 10} registros
                    </p>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}