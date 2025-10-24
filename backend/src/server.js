import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Importar configurações
import config from './config/app.js';

// Importar banco de dados baseado na configuração
let database;
if (config.database.type === 'sqlite') {
  database = await import('./config/database-sqlite.js');
} else {
  database = await import('./config/database.js');
}

const { query: dbQuery, transaction: dbTransaction } = database;
import logger, { httpLogger, logHttpRequest } from './config/logger.js';

// Importar middlewares
import { 
  generalLimiter, 
  securityHeaders, 
  sanitizeInput, 
  validateContentType,
  preventTimingAttacks,
  detectSQLInjection,
  logSuspiciousActivity 
} from './middleware/security.js';

// Importar rotas
import authRoutes from './routes/auth.js';
import passwordRoutes from './routes/passwords.js';
// import senhaRoutes from './routes/senhas.js';
// import userRoutes from './routes/users.js';
// import reportRoutes from './routes/reports.js';
// import configRoutes from './routes/config.js';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const server = createServer(app);

// Configuração do Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
});

// Configuração de CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Middlewares globais
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging HTTP personalizado
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logHttpRequest(req, res, responseTime);
  });
  
  next();
});

// Morgan para logs de acesso em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => httpLogger.http(message.trim())
    }
  }));
}

// Middlewares de segurança
app.use(logSuspiciousActivity);
app.use(detectSQLInjection);
app.use(sanitizeInput);
app.use(validateContentType);
app.use(preventTimingAttacks);
app.use(generalLimiter);

// Middleware para adicionar Socket.IO ao request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Metrics endpoint (básico)
app.get('/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    metrics: {
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      },
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    }
  });
});

// Rotas da API
import reportsRoutes from './routes/reports.js';

app.use('/api/auth', authRoutes);
app.use('/api/passwords', passwordRoutes);
app.use('/api/reports', reportsRoutes);

app.use('/api/senhas', (req, res) => {
  res.json({ message: 'Senha routes - Em desenvolvimento' });
});

app.use('/api/users', (req, res) => {
  res.json({ message: 'User routes - Em desenvolvimento' });
});

app.use('/api/reports', (req, res) => {
  res.json({ message: 'Report routes - Em desenvolvimento' });
});

app.use('/api/config', (req, res) => {
  res.json({ message: 'Config routes - Em desenvolvimento' });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Costão Chamador - Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
    metrics: '/metrics'
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware global de tratamento de erros
app.use((error, req, res, next) => {
  logger.error('Erro não tratado:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.id
  });

  // Não expor detalhes do erro em produção
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(error.status || 500).json({
    success: false,
    message: isDevelopment ? error.message : 'Erro interno do servidor',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Configuração do Socket.IO
io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);

  // Entrar em uma sala específica
  socket.on('join-room', (room) => {
    socket.join(room);
    logger.info(`Cliente ${socket.id} entrou na sala: ${room}`);
  });

  // Sair de uma sala
  socket.on('leave-room', (room) => {
    socket.leave(room);
    logger.info(`Cliente ${socket.id} saiu da sala: ${room}`);
  });

  // Evento de desconexão
  socket.on('disconnect', (reason) => {
    logger.info(`Cliente desconectado: ${socket.id}, motivo: ${reason}`);
  });

  // Eventos específicos do sistema de senhas (serão implementados)
  socket.on('call-password', (data) => {
    // Implementar lógica de chamar senha
    logger.info('Senha chamada via socket:', data);
  });

  socket.on('attend-password', (data) => {
    // Implementar lógica de atender senha
    logger.info('Senha atendida via socket:', data);
  });
});

// Função para inicializar o servidor
const startServer = async () => {
  try {
    // Testar conexão com o banco de dados
    await testDatabaseConnection();
    const dbConnected = true;
    
    if (!dbConnected) {
      logger.error('❌ Falha ao conectar com o banco de dados');
      process.exit(1);
    }

    // Definir porta
    const PORT = process.env.PORT || 3001;
    const HOST = process.env.HOST || 'localhost';

    // Iniciar servidor
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
      logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
      logger.info(`📈 Métricas: http://${HOST}:${PORT}/metrics`);
      logger.info(`🔌 Socket.IO configurado`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
};

// Tratamento de sinais do sistema
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, fechando servidor...');
  server.close(() => {
    logger.info('Servidor fechado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido, fechando servidor...');
  server.close(() => {
    logger.info('Servidor fechado');
    process.exit(0);
  });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('Exceção não capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promise rejeitada não tratada:', { reason, promise });
  process.exit(1);
});

// Testar conexão com banco de dados
const testDatabaseConnection = async () => {
  try {
    if (config.database.type === 'sqlite') {
      await database.connectSQLite();
      console.log('✅ Banco de dados SQLite conectado e pronto');
    } else {
      await database.testConnection();
      console.log('✅ Banco de dados PostgreSQL conectado e pronto');
    }
  } catch (error) {
    console.error('❌ Falha ao conectar com o banco de dados');
    logger.error('Falha ao conectar com o banco de dados', { error: error.message });
    process.exit(1);
  }
};

// Inicializar servidor
startServer();

export default app;