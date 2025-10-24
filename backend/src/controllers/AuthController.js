import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateTokens, verifyRefreshToken, blacklistToken } from '../middleware/auth.js';
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

// Função auxiliar para gerar token individual
const generateSingleToken = (userId, type = 'access') => {
  const secret = type === 'refresh' ? config.jwt.refreshSecret : config.jwt.secret;
  const expiresIn = type === 'refresh' ? config.jwt.refreshTokenExpiry : config.jwt.accessTokenExpiry;
  
  return jwt.sign(
    { userId, type },
    secret,
    { 
      expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }
  );
};

class AuthController {
  // Login do usuário
  static async login(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { email, senha } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Buscar usuário por email (incluindo inativos para verificar bloqueio)
      const user = await User.findByEmailIncludeInactive(email);
      
      if (!user) {
        logger.warn('Tentativa de login com email inexistente:', { email, ipAddress });
        return res.status(401).json({
          success: false,
          message: 'Email ou senha inválidos'
        });
      }

      // Verificar se usuário está ativo
      if (!user.ativo) {
        logger.warn('Tentativa de login com usuário inativo:', { 
          userId: user.id, 
          email, 
          ipAddress 
        });
        return res.status(401).json({
          success: false,
          message: 'Conta desativada. Entre em contato com o administrador.'
        });
      }

      // Verificar se usuário está bloqueado
      if (user.isBlocked()) {
        const tempoRestante = Math.ceil((new Date(user.bloqueado_ate) - new Date()) / 60000);
        logger.warn('Tentativa de login com usuário bloqueado:', { 
          userId: user.id, 
          email, 
          tempoRestante,
          ipAddress 
        });
        return res.status(423).json({
          success: false,
          message: `Conta temporariamente bloqueada. Tente novamente em ${tempoRestante} minutos.`
        });
      }

      // Verificar senha
      const senhaValida = await user.verifyPassword(senha);
      
      if (!senhaValida) {
        // Registrar tentativa falhada
        await user.recordLoginAttempt(false, ipAddress);
        
        return res.status(401).json({
          success: false,
          message: 'Email ou senha inválidos'
        });
      }

      // Login bem-sucedido
      await user.recordLoginAttempt(true, ipAddress);

      // Gerar tokens
      const { accessToken, refreshToken } = generateTokens(user.id);

      // Salvar refresh token no banco
      const refreshTokenHash = jwt.sign({ token: refreshToken }, config.jwt.secret);
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      await executeQuery(
        'INSERT INTO tokens (user_id, token_hash, tipo, expires_at) VALUES ($1, $2, $3, $4)',
        [user.id, refreshTokenHash, 'refresh', refreshExpiresAt]
      );

      // Resposta de sucesso
      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: user.toJSON(),
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: config.jwt.accessTokenExpiry
          }
        }
      });

    } catch (error) {
      logger.error('Erro no login:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Registro de novo usuário
  static async register(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { nome, email, senha, perfil = 'atendente' } = req.body;

      // Verificar se é admin tentando criar outro admin/atendente
      if (perfil !== 'atendente' && (!req.user || req.user.perfil !== 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Apenas administradores podem criar usuários com perfis especiais'
        });
      }

      // Criar usuário
      const novoUsuario = await User.create({
        nome,
        email,
        senha,
        perfil
      });

      logger.info('Novo usuário registrado:', {
        userId: novoUsuario.id,
        email: novoUsuario.email,
        perfil: novoUsuario.perfil,
        createdBy: req.user?.id || 'self-registration'
      });

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: {
          user: novoUsuario.toJSON()
        }
      });

    } catch (error) {
      if (error.message === 'Email já está em uso') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Erro no registro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Refresh token
  static async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token é obrigatório'
        });
      }

      // Verificar refresh token
      let decoded;
      try {
        decoded = jwt.verify(refresh_token, config.jwt.secret);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token inválido'
        });
      }

      // Verificar se token existe no banco e não foi revogado
      const refreshTokenHash = jwt.sign({ token: refresh_token }, config.jwt.secret);
      const tokenResult = await executeQuery(
        'SELECT * FROM tokens WHERE token_hash = $1 AND tipo = $2 AND revogado = false AND expires_at > CURRENT_TIMESTAMP',
        [refreshTokenHash, 'refresh']
      );

      if (tokenResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token inválido ou expirado'
        });
      }

      // Buscar usuário
      const user = await User.findById(decoded.userId);
      if (!user || !user.ativo) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não encontrado ou inativo'
        });
      }

      // Gerar novo access token
      const newAccessToken = generateSingleToken(user.id, 'access');

      res.json({
        success: true,
        message: 'Token renovado com sucesso',
        data: {
          access_token: newAccessToken,
          expires_in: config.jwt.accessTokenExpiry
        }
      });

    } catch (error) {
      logger.error('Erro no refresh token:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Logout
  static async logout(req, res) {
    try {
      const { refresh_token } = req.body;
      const accessToken = req.headers.authorization?.replace('Bearer ', '');

      // Blacklist do access token
      if (accessToken) {
        await blacklistToken(accessToken);
      }

      // Revogar refresh token se fornecido
      if (refresh_token) {
        const refreshTokenHash = jwt.sign({ token: refresh_token }, config.jwt.secret);
        await executeQuery(
          'UPDATE tokens SET revogado = true WHERE token_hash = $1 AND tipo = $2',
          [refreshTokenHash, 'refresh']
        );
      }

      logger.info('Logout realizado:', { userId: req.user?.id });

      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });

    } catch (error) {
      logger.error('Erro no logout:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Verificar token atual
  static async verifyToken(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user || !user.ativo) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
      }

      res.json({
        success: true,
        message: 'Token válido',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      logger.error('Erro na verificação do token:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Alterar senha
  static async changePassword(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { senha_atual, nova_senha } = req.body;
      const userId = req.user.id;

      // Buscar usuário
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar senha atual
      const senhaValida = await user.verifyPassword(senha_atual);
      if (!senhaValida) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Alterar senha
      await user.updatePassword(nova_senha);

      // Revogar todos os refresh tokens do usuário
      await executeQuery(
        'UPDATE tokens SET revogado = true WHERE user_id = $1 AND tipo = $2',
        [userId, 'refresh']
      );

      logger.info('Senha alterada:', { userId });

      res.json({
        success: true,
        message: 'Senha alterada com sucesso. Faça login novamente.'
      });

    } catch (error) {
      logger.error('Erro ao alterar senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Solicitar reset de senha
  static async requestPasswordReset(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { email } = req.body;

      // Buscar usuário
      const user = await User.findByEmail(email);
      
      // Sempre retornar sucesso por segurança (não revelar se email existe)
      if (!user) {
        logger.warn('Tentativa de reset para email inexistente:', { email });
        return res.json({
          success: true,
          message: 'Se o email existir, você receberá instruções para redefinir sua senha'
        });
      }

      // Gerar token de reset
      const resetToken = generateSingleToken(user.id, 'reset');
      const resetTokenHash = jwt.sign({ token: resetToken }, config.jwt.secret);
      const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Salvar token no banco
      await executeQuery(
        'INSERT INTO tokens (user_id, token_hash, tipo, expires_at) VALUES ($1, $2, $3, $4)',
        [user.id, resetTokenHash, 'reset', resetExpiresAt]
      );

      // TODO: Implementar envio de email
      logger.info('Token de reset gerado:', { 
        userId: user.id, 
        email,
        token: resetToken // Remover em produção
      });

      res.json({
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir sua senha',
        // TODO: Remover em produção
        debug: {
          reset_token: resetToken
        }
      });

    } catch (error) {
      logger.error('Erro ao solicitar reset de senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Confirmar reset de senha
  static async confirmPasswordReset(req, res) {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { token, nova_senha } = req.body;

      // Verificar token
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }

      // Verificar se token existe no banco e não foi usado
      const resetTokenHash = jwt.sign({ token }, config.jwt.secret);
      const tokenResult = await executeQuery(
        'SELECT * FROM tokens WHERE token_hash = $1 AND tipo = $2 AND revogado = false AND expires_at > CURRENT_TIMESTAMP',
        [resetTokenHash, 'reset']
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }

      // Buscar usuário
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Alterar senha
      await user.updatePassword(nova_senha);

      // Revogar token de reset
      await executeQuery(
        'UPDATE tokens SET revogado = true WHERE token_hash = $1 AND tipo = $2',
        [resetTokenHash, 'reset']
      );

      // Revogar todos os refresh tokens do usuário
      await executeQuery(
        'UPDATE tokens SET revogado = true WHERE user_id = $1 AND tipo = $2',
        [user.id, 'refresh']
      );

      logger.info('Senha redefinida via reset:', { userId: user.id });

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso. Faça login com a nova senha.'
      });

    } catch (error) {
      logger.error('Erro ao confirmar reset de senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Listar sessões ativas do usuário
  static async getActiveSessions(req, res) {
    try {
      const userId = req.user.id;

      const query = `
        SELECT id, created_at, expires_at
        FROM tokens 
        WHERE user_id = $1 
        AND tipo = 'refresh' 
        AND revogado = false 
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
      `;

      const result = await executeQuery(query, [userId]);

      res.json({
        success: true,
        message: 'Sessões ativas obtidas com sucesso',
        data: {
          sessions: result.rows
        }
      });

    } catch (error) {
      logger.error('Erro ao listar sessões ativas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Revogar todas as sessões (exceto a atual)
  static async revokeAllSessions(req, res) {
    try {
      const userId = req.user.id;
      const currentToken = req.headers.authorization?.replace('Bearer ', '');

      // Revogar todos os refresh tokens do usuário
      await executeQuery(
        'UPDATE tokens SET revogado = true WHERE user_id = $1 AND tipo = $2',
        [userId, 'refresh']
      );

      // Blacklist de todos os access tokens (exceto o atual)
      // Nota: Em uma implementação real, seria necessário um mecanismo mais sofisticado

      logger.info('Todas as sessões revogadas:', { userId });

      res.json({
        success: true,
        message: 'Todas as outras sessões foram encerradas'
      });

    } catch (error) {
      logger.error('Erro ao revogar sessões:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

export default AuthController;