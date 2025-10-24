import { body, param, query, validationResult } from 'express-validator';
import { logError } from '../config/logger.js';

// Middleware para processar resultados de validação
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    logError(new Error('Validation failed'), {
      errors: formattedErrors,
      body: req.body,
      params: req.params,
      query: req.query
    });

    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: formattedErrors
    });
  }

  next();
};

// Validações para autenticação
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email deve ser válido'),
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  handleValidationErrors
];

export const validateRegister = [
  body('nome')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email deve ser válido'),
  body('senha')
    .isLength({ min: 6, max: 50 })
    .withMessage('Senha deve ter entre 6 e 50 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número'),
  body('perfil')
    .isIn(['admin', 'atendente', 'visualizador'])
    .withMessage('Perfil deve ser admin, atendente ou visualizador'),
  handleValidationErrors
];

export const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email deve ser válido'),
  handleValidationErrors
];

export const validatePasswordUpdate = [
  body('senhaAtual')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('novaSenha')
    .isLength({ min: 6, max: 50 })
    .withMessage('Nova senha deve ter entre 6 e 50 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nova senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número'),
  handleValidationErrors
];

// Validações para senhas
export const validateGerarSenha = [
  body('tipo')
    .isIn(['normal', 'prioritario', 'express'])
    .withMessage('Tipo deve ser normal, prioritario ou express'),
  body('prioridade')
    .optional()
    .isIn(['comum', 'express'])
    .withMessage('Prioridade deve ser comum ou express'),
  body('tipo_checkin')
    .optional()
    .isIn(['proprietario', 'express', 'normal'])
    .withMessage('Tipo de check-in deve ser proprietario, express ou normal'),
  body('prioridade_nivel')
    .optional()
    .isIn(['prioritario', 'comum'])
    .withMessage('Nível de prioridade deve ser prioritario ou comum'),
  body('observacoes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Observações não podem exceder 500 caracteres'),
  handleValidationErrors
];

export const validateChamarSenha = [
  param('id')
    .isUUID()
    .withMessage('ID deve ser um UUID válido'),
  body('guiche')
    .optional()
    .isInt({ min: 1, max: 99 })
    .withMessage('Guichê deve ser um número entre 1 e 99'),
  handleValidationErrors
];

export const validateAtenderSenha = [
  param('id')
    .isUUID()
    .withMessage('ID deve ser um UUID válido'),
  body('observacoes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Observações não podem exceder 500 caracteres'),
  handleValidationErrors
];

// Validações para usuários
export const validateCreateUser = [
  body('nome')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email deve ser válido'),
  body('senha')
    .isLength({ min: 6, max: 50 })
    .withMessage('Senha deve ter entre 6 e 50 caracteres'),
  body('perfil')
    .isIn(['admin', 'atendente', 'visualizador'])
    .withMessage('Perfil deve ser admin, atendente ou visualizador'),
  handleValidationErrors
];

export const validateUpdateUser = [
  param('id')
    .isUUID()
    .withMessage('ID deve ser um UUID válido'),
  body('nome')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email deve ser válido'),
  body('perfil')
    .optional()
    .isIn(['admin', 'atendente', 'visualizador'])
    .withMessage('Perfil deve ser admin, atendente ou visualizador'),
  body('ativo')
    .optional()
    .isBoolean()
    .withMessage('Ativo deve ser verdadeiro ou falso'),
  handleValidationErrors
];

// Validações para relatórios
export const validateReportQuery = [
  query('dataInicio')
    .optional()
    .isISO8601()
    .withMessage('Data de início deve estar no formato ISO 8601'),
  query('dataFim')
    .optional()
    .isISO8601()
    .withMessage('Data de fim deve estar no formato ISO 8601'),
  query('tipo')
    .optional()
    .isIn(['normal', 'prioritario', 'express', 'todos'])
    .withMessage('Tipo deve ser normal, prioritario, express ou todos'),
  query('atendente')
    .optional()
    .isUUID()
    .withMessage('ID do atendente deve ser um UUID válido'),
  handleValidationErrors
];

// Validações para configurações
export const validateConfig = [
  body('chave')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Chave deve ter entre 1 e 100 caracteres'),
  body('valor')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Valor deve ter entre 1 e 1000 caracteres'),
  body('descricao')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Descrição não pode exceder 500 caracteres'),
  handleValidationErrors
];

// Validação de UUID genérica
export const validateUUID = (paramName = 'id') => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} deve ser um UUID válido`),
  handleValidationErrors
];

// Validação de paginação
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro maior que 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser um número entre 1 e 100'),
  handleValidationErrors
];