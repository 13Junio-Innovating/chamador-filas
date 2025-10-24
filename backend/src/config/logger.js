import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração dos níveis de log
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Cores para cada nível
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Formato para arquivos (sem cores)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configuração do transporte para arquivos de aplicação
const applicationLogTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../logs/application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
  format: fileLogFormat,
  level: 'info',
});

// Configuração do transporte para arquivos de erro
const errorLogTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
  format: fileLogFormat,
  level: 'error',
});

// Configuração do transporte para logs de acesso HTTP
const accessLogTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../logs/access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
  format: fileLogFormat,
  level: 'http',
});

// Criar logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: logFormat,
  transports: [
    applicationLogTransport,
    errorLogTransport,
  ],
});

// Adicionar console transport apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: logFormat,
    })
  );
}

// Logger específico para requisições HTTP
export const httpLogger = winston.createLogger({
  level: 'http',
  levels: logLevels,
  format: fileLogFormat,
  transports: [accessLogTransport],
});

// Função para log de requisições HTTP
export const logHttpRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
  };

  httpLogger.http('HTTP Request', logData);
};

// Função para log de erros com contexto
export const logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
};

// Função para log de eventos de autenticação
export const logAuth = (event, userId, details = {}) => {
  logger.info('Authentication Event', {
    event,
    userId,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Função para log de operações de banco de dados
export const logDatabase = (operation, table, details = {}) => {
  logger.info('Database Operation', {
    operation,
    table,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Função para log de eventos de WebSocket
export const logSocket = (event, socketId, details = {}) => {
  logger.info('Socket Event', {
    event,
    socketId,
    details,
    timestamp: new Date().toISOString(),
  });
};

export default logger;