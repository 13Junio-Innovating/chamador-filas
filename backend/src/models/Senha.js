import { pool, executeQuery } from '../config/database.js';
import logger from '../config/logger.js';
import config from '../config/app.js';

class Senha {
  constructor(data = {}) {
    this.id = data.id;
    this.numero = data.numero;
    this.prefixo = data.prefixo || 'A';
    this.tipo = data.tipo || 'geral';
    this.status = data.status || 'aguardando';
    this.usuario_id = data.usuario_id;
    this.atendente_id = data.atendente_id;
    this.guiche = data.guiche;
    this.observacoes = data.observacoes;
    this.chamada_em = data.chamada_em;
    this.atendida_em = data.atendida_em;
    this.cancelada_em = data.cancelada_em;
    this.expires_at = data.expires_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Gerar nova senha
  static async generate(options = {}) {
    try {
      const {
        tipo = 'geral',
        prefixo = config.senhas.prefixoSenha,
        usuario_id = null,
        observacoes = null
      } = options;

      // Obter próximo número da senha para hoje
      const proximoNumero = await Senha.getProximoNumero(prefixo);
      
      // Calcular tempo de expiração
      const expires_at = new Date(Date.now() + config.senhas.tempoExpiracaoSenha);

      const query = `
        INSERT INTO senhas (numero, prefixo, tipo, usuario_id, observacoes, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await executeQuery(query, [
        proximoNumero,
        prefixo,
        tipo,
        usuario_id,
        observacoes,
        expires_at
      ]);

      const novaSenha = new Senha(result.rows[0]);

      logger.info('Nova senha gerada:', {
        senhaId: novaSenha.id,
        numero: novaSenha.numero,
        prefixo: novaSenha.prefixo,
        tipo: novaSenha.tipo,
        usuario_id: novaSenha.usuario_id
      });

      return novaSenha;
    } catch (error) {
      logger.error('Erro ao gerar senha:', error);
      throw error;
    }
  }

  // Obter próximo número da senha para o dia
  static async getProximoNumero(prefixo = 'A') {
    try {
      const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      const query = `
        SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0) + 1 as proximo_numero
        FROM senhas 
        WHERE prefixo = $1 
        AND DATE(created_at) = $2
      `;

      const result = await executeQuery(query, [prefixo, hoje]);
      return result.rows[0].proximo_numero.toString().padStart(3, '0');
    } catch (error) {
      logger.error('Erro ao obter próximo número:', error);
      // Em caso de erro, retornar número inicial
      return config.senhas.numeroInicialSenha.toString().padStart(3, '0');
    }
  }

  // Buscar senha por ID
  static async findById(id) {
    try {
      const query = `
        SELECT s.*, 
               u.nome as usuario_nome,
               a.nome as atendente_nome
        FROM senhas s
        LEFT JOIN users u ON s.usuario_id = u.id
        LEFT JOIN users a ON s.atendente_id = a.id
        WHERE s.id = $1
      `;
      
      const result = await executeQuery(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const senha = new Senha(result.rows[0]);
      senha.usuario_nome = result.rows[0].usuario_nome;
      senha.atendente_nome = result.rows[0].atendente_nome;
      
      return senha;
    } catch (error) {
      logger.error('Erro ao buscar senha por ID:', error);
      throw error;
    }
  }

  // Buscar senha por número e prefixo
  static async findByNumeroAndPrefixo(numero, prefixo, data = null) {
    try {
      let query = `
        SELECT s.*, 
               u.nome as usuario_nome,
               a.nome as atendente_nome
        FROM senhas s
        LEFT JOIN users u ON s.usuario_id = u.id
        LEFT JOIN users a ON s.atendente_id = a.id
        WHERE s.numero = $1 AND s.prefixo = $2
      `;
      
      const params = [numero, prefixo];
      
      if (data) {
        query += ' AND DATE(s.created_at) = $3';
        params.push(data);
      } else {
        query += ' AND DATE(s.created_at) = CURRENT_DATE';
      }
      
      query += ' ORDER BY s.created_at DESC LIMIT 1';
      
      const result = await executeQuery(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }

      const senha = new Senha(result.rows[0]);
      senha.usuario_nome = result.rows[0].usuario_nome;
      senha.atendente_nome = result.rows[0].atendente_nome;
      
      return senha;
    } catch (error) {
      logger.error('Erro ao buscar senha por número e prefixo:', error);
      throw error;
    }
  }

  // Listar senhas com filtros
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = config.pagination.defaultLimit,
        status,
        tipo,
        prefixo,
        data_inicio,
        data_fim,
        usuario_id,
        atendente_id,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Filtros
      if (status) {
        if (Array.isArray(status)) {
          const placeholders = status.map(() => `$${paramIndex++}`).join(',');
          whereConditions.push(`s.status IN (${placeholders})`);
          queryParams.push(...status);
        } else {
          whereConditions.push(`s.status = $${paramIndex++}`);
          queryParams.push(status);
        }
      }

      if (tipo) {
        whereConditions.push(`s.tipo = $${paramIndex++}`);
        queryParams.push(tipo);
      }

      if (prefixo) {
        whereConditions.push(`s.prefixo = $${paramIndex++}`);
        queryParams.push(prefixo);
      }

      if (usuario_id) {
        whereConditions.push(`s.usuario_id = $${paramIndex++}`);
        queryParams.push(usuario_id);
      }

      if (atendente_id) {
        whereConditions.push(`s.atendente_id = $${paramIndex++}`);
        queryParams.push(atendente_id);
      }

      if (data_inicio) {
        whereConditions.push(`DATE(s.created_at) >= $${paramIndex++}`);
        queryParams.push(data_inicio);
      }

      if (data_fim) {
        whereConditions.push(`DATE(s.created_at) <= $${paramIndex++}`);
        queryParams.push(data_fim);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) 
        FROM senhas s 
        ${whereClause}
      `;
      const countResult = await executeQuery(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // Query principal
      const query = `
        SELECT s.*, 
               u.nome as usuario_nome,
               a.nome as atendente_nome
        FROM senhas s
        LEFT JOIN users u ON s.usuario_id = u.id
        LEFT JOIN users a ON s.atendente_id = a.id
        ${whereClause}
        ORDER BY s.${sortBy} ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      queryParams.push(limit, offset);
      const result = await executeQuery(query, queryParams);

      const senhas = result.rows.map(row => {
        const senha = new Senha(row);
        senha.usuario_nome = row.usuario_nome;
        senha.atendente_nome = row.atendente_nome;
        return senha;
      });

      return {
        senhas,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Erro ao listar senhas:', error);
      throw error;
    }
  }

  // Obter fila de senhas aguardando
  static async getFilaAguardando(prefixo = null) {
    try {
      let query = `
        SELECT s.*, u.nome as usuario_nome
        FROM senhas s
        LEFT JOIN users u ON s.usuario_id = u.id
        WHERE s.status = 'aguardando'
        AND DATE(s.created_at) = CURRENT_DATE
        AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
      `;
      
      const params = [];
      
      if (prefixo) {
        query += ' AND s.prefixo = $1';
        params.push(prefixo);
      }
      
      query += ' ORDER BY s.tipo DESC, s.created_at ASC'; // Prioritário primeiro
      
      const result = await executeQuery(query, params);
      
      return result.rows.map(row => {
        const senha = new Senha(row);
        senha.usuario_nome = row.usuario_nome;
        return senha;
      });
    } catch (error) {
      logger.error('Erro ao obter fila de senhas:', error);
      throw error;
    }
  }

  // Chamar senha
  async chamar(atendente_id, guiche) {
    try {
      if (this.status !== 'aguardando') {
        throw new Error('Senha não está aguardando atendimento');
      }

      const query = `
        UPDATE senhas 
        SET status = 'chamada',
            atendente_id = $1,
            guiche = $2,
            chamada_em = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await executeQuery(query, [atendente_id, guiche, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Senha não encontrada');
      }

      // Atualizar propriedades do objeto
      Object.assign(this, result.rows[0]);

      logger.info('Senha chamada:', {
        senhaId: this.id,
        numero: this.numero,
        prefixo: this.prefixo,
        atendente_id,
        guiche
      });

      return this;
    } catch (error) {
      logger.error('Erro ao chamar senha:', error);
      throw error;
    }
  }

  // Atender senha
  async atender(observacoes = null) {
    try {
      if (this.status !== 'chamada') {
        throw new Error('Senha não foi chamada ainda');
      }

      const query = `
        UPDATE senhas 
        SET status = 'atendida',
            atendida_em = CURRENT_TIMESTAMP,
            observacoes = COALESCE($1, observacoes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await executeQuery(query, [observacoes, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Senha não encontrada');
      }

      // Atualizar propriedades do objeto
      Object.assign(this, result.rows[0]);

      logger.info('Senha atendida:', {
        senhaId: this.id,
        numero: this.numero,
        prefixo: this.prefixo,
        atendente_id: this.atendente_id
      });

      return this;
    } catch (error) {
      logger.error('Erro ao atender senha:', error);
      throw error;
    }
  }

  // Cancelar senha
  async cancelar(motivo = null) {
    try {
      if (!['aguardando', 'chamada'].includes(this.status)) {
        throw new Error('Senha não pode ser cancelada neste status');
      }

      const query = `
        UPDATE senhas 
        SET status = 'cancelada',
            cancelada_em = CURRENT_TIMESTAMP,
            observacoes = COALESCE($1, observacoes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await executeQuery(query, [motivo, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Senha não encontrada');
      }

      // Atualizar propriedades do objeto
      Object.assign(this, result.rows[0]);

      logger.info('Senha cancelada:', {
        senhaId: this.id,
        numero: this.numero,
        prefixo: this.prefixo,
        motivo
      });

      return this;
    } catch (error) {
      logger.error('Erro ao cancelar senha:', error);
      throw error;
    }
  }

  // Verificar se senha expirou
  isExpired() {
    return this.expires_at && new Date() > new Date(this.expires_at);
  }

  // Marcar como expirada
  async markAsExpired() {
    try {
      if (this.status !== 'aguardando') {
        return false;
      }

      const query = `
        UPDATE senhas 
        SET status = 'expirada',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await executeQuery(query, [this.id]);
      
      if (result.rows.length === 0) {
        return false;
      }

      this.status = 'expirada';
      this.updated_at = result.rows[0].updated_at;

      logger.info('Senha marcada como expirada:', {
        senhaId: this.id,
        numero: this.numero,
        prefixo: this.prefixo
      });

      return true;
    } catch (error) {
      logger.error('Erro ao marcar senha como expirada:', error);
      throw error;
    }
  }

  // Estatísticas do dia
  static async getEstatisticasDia(data = null) {
    try {
      const dataFiltro = data || new Date().toISOString().split('T')[0];
      
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'aguardando') as aguardando,
          COUNT(*) FILTER (WHERE status = 'chamada') as chamadas,
          COUNT(*) FILTER (WHERE status = 'atendida') as atendidas,
          COUNT(*) FILTER (WHERE status = 'cancelada') as canceladas,
          COUNT(*) FILTER (WHERE status = 'expirada') as expiradas,
          COUNT(*) FILTER (WHERE tipo = 'prioritario') as prioritarias,
          AVG(EXTRACT(EPOCH FROM (atendida_em - created_at))/60) FILTER (WHERE status = 'atendida') as tempo_medio_atendimento
        FROM senhas 
        WHERE DATE(created_at) = $1
      `;

      const result = await executeQuery(query, [dataFiltro]);
      
      return {
        data: dataFiltro,
        ...result.rows[0],
        tempo_medio_atendimento: parseFloat(result.rows[0].tempo_medio_atendimento || 0).toFixed(2)
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas do dia:', error);
      throw error;
    }
  }

  // Limpar senhas expiradas
  static async cleanupExpired() {
    try {
      const result = await executeQuery('SELECT cleanup_expired_senhas()');
      const count = result.rows[0].cleanup_expired_senhas;
      
      if (count > 0) {
        logger.info(`${count} senhas marcadas como expiradas`);
      }
      
      return count;
    } catch (error) {
      logger.error('Erro ao limpar senhas expiradas:', error);
      throw error;
    }
  }

  // Obter senha completa formatada
  getSenhaCompleta() {
    return `${this.prefixo}${this.numero}`;
  }

  // Converter para JSON
  toJSON() {
    return {
      id: this.id,
      numero: this.numero,
      prefixo: this.prefixo,
      senha_completa: this.getSenhaCompleta(),
      tipo: this.tipo,
      status: this.status,
      usuario_id: this.usuario_id,
      usuario_nome: this.usuario_nome,
      atendente_id: this.atendente_id,
      atendente_nome: this.atendente_nome,
      guiche: this.guiche,
      observacoes: this.observacoes,
      chamada_em: this.chamada_em,
      atendida_em: this.atendida_em,
      cancelada_em: this.cancelada_em,
      expires_at: this.expires_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_expired: this.isExpired()
    };
  }
}

export default Senha;