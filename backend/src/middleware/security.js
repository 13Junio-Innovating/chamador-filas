import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { logError, logAuth } from '../config/logger.js';

// Rate limiting geral
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por IP
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logAuth('rate_limit_exceeded', req.user?.id || 'anonymous', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    
    res.status(429).json({
      success: false,
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// Rate limiting mais restritivo para login
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login por IP
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  handler: (req, res) => {
    logAuth('login_rate_limit_exceeded', null, {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED'
    });
  }
});

// Rate limiting para criação de senhas
export const senhaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // máximo 10 senhas por minuto por IP
  message: {
    success: false,
    message: 'Muitas senhas geradas. Aguarde um momento.',
    code: 'SENHA_RATE_LIMIT_EXCEEDED'
  },
  handler: (req, res) => {
    logAuth('senha_rate_limit_exceeded', req.user?.id || 'anonymous', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      message: 'Muitas senhas geradas. Aguarde um momento.',
      code: 'SENHA_RATE_LIMIT_EXCEEDED'
    });
  }
});

// Configuração do Helmet para headers de segurança
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Desabilitado para compatibilidade
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Middleware para sanitizar entrada de dados
export const sanitizeInput = (req, res, next) => {
  try {
    // Função recursiva para sanitizar objetos
    const sanitize = (obj) => {
      if (typeof obj === 'string') {
        // Remove caracteres potencialmente perigosos
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitize(value);
        }
        return sanitized;
      }
      
      return obj;
    };

    // Sanitizar body, query e params
    if (req.body) {
      req.body = sanitize(req.body);
    }
    
    if (req.query) {
      req.query = sanitize(req.query);
    }
    
    if (req.params) {
      req.params = sanitize(req.params);
    }

    next();
  } catch (error) {
    logError(error, { 
      middleware: 'sanitizeInput',
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    res.status(400).json({
      success: false,
      message: 'Dados de entrada inválidos'
    });
  }
};

// Middleware para validar Content-Type em requisições POST/PUT
export const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type deve ser application/json'
      });
    }
  }
  
  next();
};

// Middleware para prevenir ataques de timing
export const preventTimingAttacks = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Adicionar delay mínimo para operações sensíveis
    if (req.path.includes('/auth/') && duration < 100) {
      setTimeout(() => {}, 100 - duration);
    }
  });
  
  next();
};

// Middleware para detectar tentativas de SQL injection
export const detectSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*?[=<>]/i,
    /\b(WAITFOR|DELAY)\b/i
  ];

  const checkForSQLInjection = (obj) => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkForSQLInjection);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkForSQLInjection);
    }
    
    return false;
  };

  const hasSQLInjection = 
    checkForSQLInjection(req.body) ||
    checkForSQLInjection(req.query) ||
    checkForSQLInjection(req.params);

  if (hasSQLInjection) {
    logAuth('sql_injection_attempt', req.user?.id || 'anonymous', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query,
      params: req.params,
      endpoint: req.path
    });

    return res.status(400).json({
      success: false,
      message: 'Requisição inválida detectada'
    });
  }

  next();
};

// Middleware para log de requisições suspeitas
export const logSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /%2e%2e%2f/i,  // Encoded path traversal
    /<script/i,  // XSS attempts
    /javascript:/i,  // JavaScript injection
    /vbscript:/i,  // VBScript injection
  ];

  const checkSuspicious = (str) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const url = req.originalUrl || req.url;
  const userAgent = req.get('User-Agent') || '';
  
  if (checkSuspicious(url) || checkSuspicious(userAgent)) {
    logAuth('suspicious_activity', req.user?.id || 'anonymous', {
      ip: req.ip,
      userAgent,
      url,
      method: req.method,
      headers: req.headers
    });
  }

  next();
};