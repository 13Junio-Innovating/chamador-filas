import jwt from 'jsonwebtoken';
import config from '../config/app.js';
import logger, { logAuth, logError } from '../config/logger.js';

// Importar database baseado na configuração
let database;
if (config.database.type === 'sqlite') {
  database = await import('../config/database-sqlite.js');
} else {
  database = await import('../config/database.js');
}

const { query } = database;

// Middleware para verificar token JWT
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso requerido'
      });
    }

    // Verificar se o token está na blacklist
    const blacklistCheck = await query(
      'SELECT id FROM token_blacklist WHERE token = ?',
      [token]
    );

    if (blacklistCheck.rows.length > 0) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar dados atualizados do usuário
    const userResult = await query(
      'SELECT id, email, nome, perfil, ativo, created_at FROM usuarios WHERE id = ? AND ativo = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo'
      });
    }

    // Adicionar dados do usuário à requisição
    req.user = {
      id: decoded.userId,
      email: userResult.rows[0].email,
      nome: userResult.rows[0].nome,
      perfil: userResult.rows[0].perfil,
      iat: decoded.iat,
      exp: decoded.exp
    };

    logAuth('token_verified', req.user.id, { 
      email: req.user.email,
      ip: req.ip 
    });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }

    logError(error, { 
      middleware: 'authenticateToken',
      headers: req.headers 
    });

    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar perfil de usuário
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const userRole = req.user.perfil;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logAuth('access_denied', req.user.id, { 
        requiredRoles: allowedRoles,
        userRole,
        endpoint: req.path 
      });

      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissões insuficientes.'
      });
    }

    next();
  };
};

// Middleware para verificar se é admin
export const requireAdmin = requireRole(['admin']);

// Middleware para verificar se é atendente ou admin
export const requireAtendente = requireRole(['atendente', 'admin']);

// Middleware opcional de autenticação (não falha se não houver token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await query(
      'SELECT id, email, nome, perfil, ativo FROM usuarios WHERE id = ? AND ativo = true',
      [decoded.userId]
    );

    if (userResult.rows.length > 0) {
      req.user = {
        id: decoded.userId,
        email: userResult.rows[0].email,
        nome: userResult.rows[0].nome,
        perfil: userResult.rows[0].perfil
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Em caso de erro, continua sem usuário autenticado
    req.user = null;
    next();
  }
};

// Função para gerar tokens
export const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    config.jwt.secret,
    { expiresIn: config.jwt.accessTokenExpiry }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshTokenExpiry }
  );

  return { accessToken, refreshToken };
};

// Função para verificar refresh token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw error;
  }
};

// Função para adicionar token à blacklist
export const blacklistToken = async (token) => {
  try {
    await query(
      'INSERT INTO token_blacklist (token, created_at) VALUES (?, datetime("now"))',
      [token]
    );
    return true;
  } catch (error) {
    logError(error, { function: 'blacklistToken', token });
    return false;
  }
};