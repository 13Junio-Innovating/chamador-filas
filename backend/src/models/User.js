import bcrypt from 'bcryptjs';
import logger from '../config/logger.js';
import config from '../config/app.js';

// Importar banco de dados baseado na configuração
let database;
if (config.database.type === 'sqlite') {
  database = await import('../config/database-sqlite.js');
} else {
  database = await import('../config/database.js');
}

const { query: executeQuery } = database;

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.nome = data.nome;
    this.email = data.email;
    this.senha_hash = data.senha_hash;
    this.perfil = data.perfil || 'atendente';
    this.ativo = data.ativo !== undefined ? data.ativo : true;
    this.ultimo_login = data.ultimo_login;
    this.tentativas_login = data.tentativas_login || 0;
    this.bloqueado_ate = data.bloqueado_ate;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Criar novo usuário
  static async create(userData) {
    try {
      const { nome, email, senha, perfil = 'atendente' } = userData;

      // Verificar se email já existe
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new Error('Email já está em uso');
      }

      // Hash da senha
      const senha_hash = await bcrypt.hash(senha, config.security.bcryptRounds);

      const query = `
        INSERT INTO usuarios (nome, email, senha_hash, perfil)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await executeQuery(query, [nome, email, senha_hash, perfil]);
      
      logger.info('Usuário criado:', { 
        userId: result.rows[0].id, 
        email: result.rows[0].email,
        perfil: result.rows[0].perfil 
      });

      return new User(result.rows[0]);
    } catch (error) {
      logger.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  // Buscar usuário por ID
  static async findById(id) {
    try {
      const query = 'SELECT * FROM usuarios WHERE id = $1 AND ativo = true';
      const result = await executeQuery(query, [id]);
      
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      logger.error('Erro ao buscar usuário por ID:', error);
      throw error;
    }
  }

  // Buscar usuário por email
  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM usuarios WHERE email = $1 AND ativo = true';
      const result = await executeQuery(query, [email]);
      
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      logger.error('Erro ao buscar usuário por email:', error);
      throw error;
    }
  }

  // Buscar usuário por email (incluindo inativos)
  static async findByEmailIncludeInactive(email) {
    try {
      const query = 'SELECT * FROM usuarios WHERE email = $1';
      const result = await executeQuery(query, [email]);
      
      return result.rows.length > 0 ? new User(result.rows[0]) : null;
    } catch (error) {
      logger.error('Erro ao buscar usuário por email (incluindo inativos):', error);
      throw error;
    }
  }

  // Listar usuários com paginação
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = config.pagination.defaultLimit,
        perfil,
        ativo,
        search,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Filtros
      if (perfil) {
        whereConditions.push(`perfil = $${paramIndex++}`);
        queryParams.push(perfil);
      }

      if (ativo !== undefined) {
        whereConditions.push(`ativo = $${paramIndex++}`);
        queryParams.push(ativo);
      }

      if (search) {
        whereConditions.push(`(nome ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query para contar total
      const countQuery = `SELECT COUNT(*) FROM usuarios ${whereClause}`;
      const countResult = await executeQuery(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // Query principal
      const query = `
        SELECT id, nome, email, perfil, ativo, ultimo_login, created_at, updated_at
        FROM usuarios 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;

      queryParams.push(limit, offset);
      const result = await executeQuery(query, queryParams);

      const users = result.rows.map(row => new User(row));

      return {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Erro ao listar usuários:', error);
      throw error;
    }
  }

  // Atualizar usuário
  async update(updateData) {
    try {
      const allowedFields = ['nome', 'email', 'perfil', 'ativo'];
      const updates = [];
      const values = [];
      let paramIndex = 1;

      // Construir query dinamicamente
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (updates.length === 0) {
        throw new Error('Nenhum campo válido para atualizar');
      }

      // Verificar se email já existe (se estiver sendo atualizado)
      if (updateData.email && updateData.email !== this.email) {
        const existingUser = await User.findByEmail(updateData.email);
        if (existingUser && existingUser.id !== this.id) {
          throw new Error('Email já está em uso');
        }
      }

      values.push(this.id);
      const query = `
        UPDATE usuarios 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await executeQuery(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      // Atualizar propriedades do objeto
      Object.assign(this, result.rows[0]);

      logger.info('Usuário atualizado:', { 
        userId: this.id, 
        updatedFields: Object.keys(updateData) 
      });

      return this;
    } catch (error) {
      logger.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  // Alterar senha
  async updatePassword(novaSenha) {
    try {
      const senha_hash = await bcrypt.hash(novaSenha, config.security.bcryptRounds);
      
      const query = `
        UPDATE usuarios 
        SET senha_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `;

      const result = await executeQuery(query, [senha_hash, this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      this.senha_hash = senha_hash;

      logger.info('Senha alterada:', { userId: this.id });
      return true;
    } catch (error) {
      logger.error('Erro ao alterar senha:', error);
      throw error;
    }
  }

  // Verificar senha
  async verifyPassword(senha) {
    try {
      return await bcrypt.compare(senha, this.senha_hash);
    } catch (error) {
      logger.error('Erro ao verificar senha:', error);
      return false;
    }
  }

  // Registrar tentativa de login
  async recordLoginAttempt(success = false, ipAddress = null) {
    try {
      if (success) {
        // Login bem-sucedido - resetar tentativas e atualizar último login
        const query = `
          UPDATE usuarios 
          SET tentativas_login = 0, 
              bloqueado = false, 
              ultimo_login = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `;
        await executeQuery(query, [this.id]);
        
        this.tentativas_login = 0;
        this.bloqueado = false;
        this.ultimo_login = new Date();

        logger.info('Login bem-sucedido:', { 
          userId: this.id, 
          email: this.email,
          ipAddress 
        });
      } else {
        // Login falhado - incrementar tentativas
        const novasTentativas = this.tentativas_login + 1;
        let bloqueado = false;

        // Bloquear após 5 tentativas
        if (novasTentativas >= 5) {
          bloqueado = true;
        }

        const query = `
          UPDATE usuarios 
          SET tentativas_login = $1, 
              bloqueado = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `;
        await executeQuery(query, [novasTentativas, bloqueado, this.id]);
        
        this.tentativas_login = novasTentativas;
        this.bloqueado = bloqueado;

        logger.warn('Tentativa de login falhada:', { 
          userId: this.id, 
          email: this.email,
          tentativas: novasTentativas,
          bloqueado: bloqueado,
          ipAddress 
        });
      }
    } catch (error) {
      logger.error('Erro ao registrar tentativa de login:', error);
      throw error;
    }
  }

  // Verificar se usuário está bloqueado
  isBlocked() {
    return this.bloqueado;
  }

  // Desbloquear usuário
  async unblock() {
    try {
      const query = `
        UPDATE usuarios 
        SET tentativas_login = 0, 
            bloqueado = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await executeQuery(query, [this.id]);
      
      this.tentativas_login = 0;
      this.bloqueado = false;

      logger.info('Usuário desbloqueado:', { userId: this.id });
      return true;
    } catch (error) {
      logger.error('Erro ao desbloquear usuário:', error);
      throw error;
    }
  }

  // Desativar usuário (soft delete)
  async deactivate() {
    try {
      const query = `
        UPDATE usuarios 
        SET ativo = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const result = await executeQuery(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      this.ativo = false;

      logger.info('Usuário desativado:', { userId: this.id });
      return this;
    } catch (error) {
      logger.error('Erro ao desativar usuário:', error);
      throw error;
    }
  }

  // Reativar usuário
  async activate() {
    try {
      const query = `
        UPDATE usuarios 
        SET ativo = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const result = await executeQuery(query, [this.id]);
      
      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      this.ativo = true;

      logger.info('Usuário reativado:', { userId: this.id });
      return this;
    } catch (error) {
      logger.error('Erro ao reativar usuário:', error);
      throw error;
    }
  }

  // Converter para JSON (sem dados sensíveis)
  toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      perfil: this.perfil,
      ativo: this.ativo,
      ultimo_login: this.ultimo_login,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  // Converter para JSON com dados completos (para admin)
  toFullJSON() {
    return {
      id: this.id,
      nome: this.nome,
      email: this.email,
      perfil: this.perfil,
      ativo: this.ativo,
      ultimo_login: this.ultimo_login,
      tentativas_login: this.tentativas_login,
      bloqueado_ate: this.bloqueado_ate,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

export default User;