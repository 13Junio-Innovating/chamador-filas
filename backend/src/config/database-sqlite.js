import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './app.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

// Configuração do SQLite
const dbConfig = {
  filename: config.database.path || join(__dirname, '../../database.sqlite'),
  driver: sqlite3.Database
};

// Função para conectar ao SQLite
export const connectSQLite = async () => {
  try {
    db = await open(dbConfig);
    
    // Habilitar foreign keys
    await db.exec('PRAGMA foreign_keys = ON');
    
    console.log('✅ Conectado ao SQLite');
    logger.info('Conectado ao SQLite', { database: dbConfig.filename });
    
    // Criar tabelas se não existirem
    await createTables();
    
    return db;
  } catch (error) {
    console.error('❌ Erro ao conectar com SQLite:', error.message);
    logger.error('Erro ao conectar com SQLite', { error: error.message });
    throw error;
  }
};

// Função para criar tabelas
const createTables = async () => {
  try {
    // Tabela de usuários
    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL,
        senha_hash TEXT NOT NULL,
        perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'atendente')),
        ativo BOOLEAN DEFAULT true,
        bloqueado BOOLEAN DEFAULT false,
        tentativas_login INTEGER DEFAULT 0,
        ultimo_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de tokens
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('refresh', 'reset')),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    // Tabela de blacklist de tokens
    await db.exec(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de configurações
    await db.exec(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        chave TEXT UNIQUE NOT NULL,
        valor TEXT NOT NULL,
        descricao TEXT,
        tipo TEXT DEFAULT 'string',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de senhas
    await db.exec(`
      CREATE TABLE IF NOT EXISTS senhas (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        numero INTEGER NOT NULL,
        prefixo TEXT DEFAULT 'A',
        tipo TEXT NOT NULL CHECK (tipo IN ('normal', 'prioritario', 'express')),
        tipo_checkin TEXT CHECK (tipo_checkin IN ('proprietario', 'express', 'normal')),
        prioridade_nivel TEXT CHECK (prioridade_nivel IN ('prioritario', 'comum')),
        status TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'chamando', 'atendendo', 'atendida', 'cancelada', 'expirada')),
        prioridade TEXT DEFAULT 'comum' CHECK (prioridade IN ('comum', 'express')),
        user_id TEXT,
        atendente_id TEXT,
        guiche TEXT,
        observacoes TEXT,
        chamada_em DATETIME,
        atendida_em DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES usuarios(id),
        FOREIGN KEY (atendente_id) REFERENCES usuarios(id)
      )
    `);

    // Tabela de relatórios
    await db.exec(`
      CREATE TABLE IF NOT EXISTS relatorios (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        tipo TEXT NOT NULL,
        dados TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES usuarios(id)
      )
    `);

    // Inserir usuário admin padrão se não existir
    const adminExists = await db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@costao.com']);
    
    if (!adminExists) {
      // Hash da senha 'admin123' (deve ser alterada em produção)
      const bcrypt = await import('bcryptjs');
      const senhaHash = await bcrypt.default.hash('admin123', 12);
      
      await db.run(`
        INSERT INTO usuarios (email, nome, senha_hash, perfil)
        VALUES (?, ?, ?, ?)
      `, ['admin@costao.com', 'Administrador', senhaHash, 'admin']);
      
      console.log('✅ Usuário administrador criado (admin@costao.com / admin123)');
    }

    // Inserir configurações padrão
    const configs = [
      ['max_senhas_por_usuario', '5', 'Máximo de senhas por usuário'],
      ['tempo_expiracao_senha', '3600000', 'Tempo de expiração da senha em ms'],
      ['prefixo_senha_padrao', 'A', 'Prefixo padrão para senhas'],
      ['numero_inicial_senha', '1', 'Número inicial para senhas']
    ];

    for (const [chave, valor, descricao] of configs) {
      const exists = await db.get('SELECT id FROM configuracoes WHERE chave = ?', [chave]);
      if (!exists) {
        await db.run(`
          INSERT INTO configuracoes (chave, valor, descricao)
          VALUES (?, ?, ?)
        `, [chave, valor, descricao]);
      }
    }

    console.log('✅ Tabelas SQLite criadas/verificadas');
    logger.info('Tabelas SQLite criadas/verificadas');
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas SQLite:', error.message);
    logger.error('Erro ao criar tabelas SQLite', { error: error.message });
    throw error;
  }
};

// Função para executar queries
export const query = async (sql, params = []) => {
  try {
    if (!db) {
      await connectSQLite();
    }

    // Adaptar query PostgreSQL para SQLite
    let adaptedSql = sql;
    let adaptedParams = params;

    // Substituir $1, $2, etc. por ?
    if (sql.includes('$')) {
      let paramIndex = 1;
      adaptedSql = sql.replace(/\$\d+/g, () => '?');
    }

    // Substituir RETURNING por uma abordagem SQLite
    if (adaptedSql.includes('RETURNING')) {
      adaptedSql = adaptedSql.replace(/\s+RETURNING\s+.*$/i, '');
      
      if (adaptedSql.trim().toUpperCase().startsWith('INSERT')) {
        const result = await db.run(adaptedSql, adaptedParams);
        return {
          rows: [{ id: result.lastID }],
          rowCount: result.changes
        };
      }
    }

    // Executar query
    if (adaptedSql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await db.all(adaptedSql, adaptedParams);
      return { rows, rowCount: rows.length };
    } else {
      const result = await db.run(adaptedSql, adaptedParams);
      return { rows: [], rowCount: result.changes };
    }
    
  } catch (error) {
    logger.error('Erro na query SQLite', { 
      sql: sql.substring(0, 100),
      error: error.message 
    });
    throw error;
  }
};

// Função para transações
export const transaction = async (callback) => {
  if (!db) {
    await connectSQLite();
  }
  
  try {
    await db.exec('BEGIN TRANSACTION');
    const result = await callback(db);
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
};

// Função para fechar conexão
export const closeDatabase = async () => {
  if (db) {
    await db.close();
    db = null;
    console.log('SQLite connection closed');
  }
};

// Exportar como padrão para compatibilidade
export default { query, transaction, close: closeDatabase };