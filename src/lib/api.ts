// API service for backend integration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface LoginCredentials {
  email: string;
  senha: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    nome: string;
    tipo: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

// Interface para dados de senha
interface SenhaData {
  id: string;
  numero: number;
  prefixo?: string;
  senha_completa?: string;
  tipo: 'normal' | 'prioritario' | 'express' | 'preferencial' | 'proprietario' | 'check-in' | 'check-out';
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

// Interface para dados de relatório diário
interface DailyReportData {
  date: string;
  senhas: {
    rows: SenhaData[];
    rowCount: number;
  };
}

// Interface para dados de relatório mensal
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

// Interface para dados de performance
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

// Interface para dados de relatório de performance
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

// Interface para dados de exportação
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

// Interface para resposta de geração de senha
interface GeneratePasswordResponse {
  id: string;
  numero: number;
  prefixo?: string;
  senha_completa: string;
  tipo: string;
  status: string;
  usuario_id?: string;
  created_at: string;
  expires_at?: string;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage on initialization
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header if token exists
    if (this.accessToken) {
      (headers as Record<string, string>).Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      // Handle token expiration
      if (response.status === 401 && data.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request with new token
          (headers as Record<string, string>).Authorization = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
          });
          return await retryResponse.json();
        } else {
          // Refresh failed, redirect to login
          this.clearTokens();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      }

      return data;
    } catch (error: unknown) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.data?.tokens) {
        this.setTokens(data.data.tokens.access_token, data.data.tokens.refresh_token);
        return true;
      }

      return false;
    } catch (error: unknown) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  private setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data?.tokens) {
      this.setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.clearTokens();
    }
  }

  // Report methods
  async getDailyReport(date: string): Promise<ApiResponse<DailyReportData>> {
    return this.request<DailyReportData>(`/api/reports/daily?date=${date}`);
  }

  async getMonthlyReport(year: number, month: number): Promise<ApiResponse<MonthlyReportData>> {
    return this.request<MonthlyReportData>(`/api/reports/monthly?year=${year}&month=${month}`);
  }

  async getExportReport(startDate: string, endDate: string): Promise<ApiResponse<ExportData[]>> {
    return this.request<ExportData[]>(`/api/reports/export?startDate=${startDate}&endDate=${endDate}`);
  }

  async getPerformanceReport(startDate: string, endDate: string): Promise<ApiResponse<PerformanceReportData>> {
    return this.request<PerformanceReportData>(`/api/reports/performance?startDate=${startDate}&endDate=${endDate}`);
  }

  // Password generation methods
  async generatePassword(tipo: 'normal' | 'prioritario' | 'express'): Promise<ApiResponse<GeneratePasswordResponse>> {
    return this.request<GeneratePasswordResponse>('/api/passwords/generate', {
      method: 'POST',
      body: JSON.stringify({ tipo }),
    });
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;