import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Validar variáveis de ambiente obrigatórias baseado no tipo de banco
const requiredEnvVars = ['JWT_SECRET'];

// Adicionar variáveis específicas do PostgreSQL se necessário
if (process.env.DB_TYPE !== 'sqlite') {
  requiredEnvVars.push('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Variáveis de ambiente obrigatórias não encontradas:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\n📝 Verifique o arquivo .env e configure as variáveis necessárias.');
  process.exit(1);
}

// Configurações da aplicação
const config = {
  // Configurações do servidor
  server: {
    port: parseInt(process.env.PORT) || 3001,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development'
  },

  // Configurações do banco de dados
  database: {
    type: process.env.DB_TYPE || 'postgresql',
    path: process.env.DB_PATH || './database.sqlite',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000
  },

  // Configurações JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'costao-chamador',
    audience: process.env.JWT_AUDIENCE || 'costao-users'
  },

  // Configurações de CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  },

  // Configurações do Socket.IO
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173',
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
  },

  // Configurações de rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    loginWindowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
    loginMaxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5,
    senhaWindowMs: parseInt(process.env.SENHA_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
    senhaMaxRequests: parseInt(process.env.SENHA_RATE_LIMIT_MAX_REQUESTS) || 10
  },

  // Configurações de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14,
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },

  // Configurações de backup
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Todo dia às 2h
    retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    path: process.env.BACKUP_PATH || './backups'
  },

  // Configurações de email (se necessário)
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@costao.com'
  },

  // Configurações de monitoramento
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    endpoint: process.env.MONITORING_ENDPOINT,
    interval: parseInt(process.env.MONITORING_INTERVAL) || 60000 // 1 minuto
  },

  // Configurações de segurança
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionSecret: process.env.SESSION_SECRET || 'default-session-secret',
    csrfEnabled: process.env.CSRF_ENABLED === 'true',
    helmetEnabled: process.env.HELMET_ENABLED !== 'false'
  },

  // Configurações específicas do sistema de senhas
  senhas: {
    maxSenhasPorUsuario: parseInt(process.env.MAX_SENHAS_POR_USUARIO) || 5,
    tempoExpiracaoSenha: parseInt(process.env.TEMPO_EXPIRACAO_SENHA) || 3600000, // 1 hora
    prefixoSenha: process.env.PREFIXO_SENHA || 'A',
    numeroInicialSenha: parseInt(process.env.NUMERO_INICIAL_SENHA) || 1
  },

  // Configurações de paginação
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT) || 20,
    maxLimit: parseInt(process.env.MAX_PAGE_LIMIT) || 100
  }
};

// Função para validar configurações
export const validateConfig = () => {
  const errors = [];

  // Validar porta
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Porta do servidor deve estar entre 1 e 65535');
  }

  // Validar configurações do banco
  if (config.database.port < 1 || config.database.port > 65535) {
    errors.push('Porta do banco de dados deve estar entre 1 e 65535');
  }

  if (config.database.maxConnections < 1) {
    errors.push('Número máximo de conexões deve ser maior que 0');
  }

  // Validar JWT secret
  if (config.jwt.secret.length < 32) {
    errors.push('JWT_SECRET deve ter pelo menos 32 caracteres');
  }

  // Validar bcrypt rounds
  if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
    errors.push('BCRYPT_ROUNDS deve estar entre 10 e 15');
  }

  if (errors.length > 0) {
    console.error('❌ Erros de configuração encontrados:');
    errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }

  return true;
};

// Função para exibir configurações (sem dados sensíveis)
export const displayConfig = () => {
  console.log('📋 Configurações da aplicação:');
  console.log(`   🌐 Servidor: ${config.server.host}:${config.server.port}`);
  console.log(`   🗄️  Banco: ${config.database.host}:${config.database.port}/${config.database.name}`);
  console.log(`   🔐 JWT: Configurado (${config.jwt.accessTokenExpiry})`);
  console.log(`   🌍 Ambiente: ${config.server.environment}`);
  console.log(`   📊 Log Level: ${config.logging.level}`);
  console.log(`   🔒 Rate Limit: ${config.rateLimit.maxRequests} req/${config.rateLimit.windowMs}ms`);
  
  if (config.backup.enabled) {
    console.log(`   💾 Backup: Habilitado (${config.backup.schedule})`);
  }
  
  if (config.monitoring.enabled) {
    console.log(`   📈 Monitoramento: Habilitado`);
  }
};

export default config;