import express from 'express';
import AuthController from '../controllers/AuthController.js';
import { 
  authenticateToken, 
  optionalAuth,
  requireAdmin 
} from '../middleware/auth.js';
import {
  validateLogin,
  validateRegister,
  validatePasswordReset,
  validatePasswordUpdate,
  validateGerarSenha,
  validateUUID,
  validatePagination,
  handleValidationErrors
} from '../middleware/validation.js';
import { 
  loginLimiter,
  generalLimiter 
} from '../middleware/security.js';

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login do usuário
 * @access  Public
 */
router.post('/login', 
  loginLimiter,
  validateLogin,
  AuthController.login
);

/**
 * @route   POST /api/auth/register
 * @desc    Registro de novo usuário
 * @access  Public (para usuários comuns) / Admin (para roles especiais)
 */
router.post('/register',
  generalLimiter,
  optionalAuth, // Permite tanto usuários não autenticados quanto admins
  validateRegister,
  AuthController.register
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Renovar access token usando refresh token
 * @access  Public
 */
router.post('/refresh',
  generalLimiter,
  AuthController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout do usuário
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  AuthController.logout
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar se token é válido
 * @access  Private
 */
router.get('/verify',
  authenticateToken,
  AuthController.verifyToken
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Alterar senha do usuário logado
 * @access  Private
 */
router.put('/change-password',
  authenticateToken,
  generalLimiter,
  validatePasswordUpdate,
  AuthController.changePassword
);

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Solicitar reset de senha
 * @access  Public
 */
router.post('/request-password-reset',
  generalLimiter,
  validatePasswordReset,
  AuthController.requestPasswordReset
);

/**
 * @route   POST /api/auth/confirm-password-reset
 * @desc    Confirmar reset de senha com token
 * @access  Public
 */
router.post('/confirm-password-reset',
  generalLimiter,
  validatePasswordUpdate,
  AuthController.confirmPasswordReset
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Listar sessões ativas do usuário
 * @access  Private
 */
router.get('/sessions',
  authenticateToken,
  AuthController.getActiveSessions
);

/**
 * @route   POST /api/auth/revoke-sessions
 * @desc    Revogar todas as sessões (exceto a atual)
 * @access  Private
 */
router.post('/revoke-sessions',
  authenticateToken,
  AuthController.revokeAllSessions
);

// Middleware para capturar erros das rotas
router.use((error, req, res, next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Dados de entrada inválidos',
      errors: error.details
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado'
    });
  }

  // Erro genérico
  console.error('Erro nas rotas de auth:', error);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  });
});

export default router;