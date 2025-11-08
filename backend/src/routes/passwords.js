import express from 'express';
import { 
  validateGerarSenha, 
  validateChamarSenha, 
  validateAtenderSenha,
  validateUUID,
  validatePagination
} from '../middleware/validation.js';
import { authenticateToken as requireAuth, requireAtendente } from '../middleware/auth.js';
import { generalLimiter, senhaLimiter } from '../middleware/security.js';
import {
  gerarSenha,
  obterFila,
  chamarSenha,
  atenderSenha,
  obterDetalhes,
  cancelarSenha,
  obterHistorico,
  debugSenhasColumns
} from '../controllers/PasswordController.js';

const router = express.Router();

// Aplicar rate limiting geral
router.use(generalLimiter);

/**
 * @route   POST /api/passwords/generate
 * @desc    Gerar nova senha
 * @access  Public
 */
router.post('/generate', 
  senhaLimiter,
  validateGerarSenha,
  gerarSenha
);

/**
 * @route   GET /api/passwords/queue
 * @desc    Obter fila de senhas
 * @access  Public
 */
router.get('/queue',
  validatePagination,
  obterFila
);

/**
 * @route   GET /api/passwords/debug/columns
 * @desc    Expor colunas detectadas da tabela 'senhas' (diagnóstico)
 * @access  Public (temporário para debug)
 */
router.get('/debug/columns', debugSenhasColumns);

/**
 * @route   GET /api/passwords/history
 * @desc    Obter histórico de senhas
 * @access  Private (Atendente)
 */
router.get('/history',
  requireAuth,
  requireAtendente,
  validatePagination,
  obterHistorico
);

/**
 * @route   PUT /api/passwords/:id/call
 * @desc    Chamar senha
 * @access  Private (Atendente)
 */
router.put('/:id/call',
  requireAuth,
  requireAtendente,
  validateUUID('id'),
  validateChamarSenha,
  chamarSenha
);

/**
 * @route   PUT /api/passwords/:id/attend
 * @desc    Atender senha
 * @access  Private (Atendente)
 */
router.put('/:id/attend',
  requireAuth,
  requireAtendente,
  validateUUID('id'),
  validateAtenderSenha,
  atenderSenha
);

/**
 * @route   GET /api/passwords/:id
 * @desc    Obter detalhes de uma senha
 * @access  Public
 */
router.get('/:id',
  validateUUID('id'),
  obterDetalhes
);

/**
 * @route   DELETE /api/passwords/:id
 * @desc    Cancelar senha
 * @access  Private (Atendente)
 */
router.delete('/:id',
  requireAuth,
  requireAtendente,
  validateUUID('id'),
  cancelarSenha
);

export default router;