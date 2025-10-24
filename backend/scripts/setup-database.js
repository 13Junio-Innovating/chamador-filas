import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração do banco
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres' // Conectar ao banco padrão primeiro
};

const targetDatabase = process.env.DB_NAME || 'costao_chamador';

async function setupDatabase() {
  let client;
  
  try {
    console.log('🔄 Conectando ao PostgreSQL...');
    client = new Client(dbConfig);
    await client.connect();
    console.log('✅ Conectado ao PostgreSQL');

    // Verificar se o banco de dados existe
    const dbExists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDatabase]
    );

    if (dbExists.rows.length === 0) {
      console.log(`🔄 Criando banco de dados ${targetDatabase}...`);
      await client.query(`CREATE DATABASE ${targetDatabase}`);
      console.log(`✅ Banco de dados ${targetDatabase} criado`);
    } else {
      console.log(`✅ Banco de dados ${targetDatabase} já existe`);
    }

    await client.end();

    // Conectar ao banco de dados específico
    const targetClient = new Client({
      ...dbConfig,
      database: targetDatabase
    });

    await targetClient.connect();
    console.log(`✅ Conectado ao banco ${targetDatabase}`);

    // Executar script de inicialização
    console.log('🔄 Executando script de inicialização...');
    const sqlScript = readFileSync(
      join(__dirname, 'init-database.sql'),
      'utf8'
    );

    await targetClient.query(sqlScript);
    console.log('✅ Script de inicialização executado com sucesso');

    await targetClient.end();
    console.log('🎉 Configuração do banco de dados concluída!');

  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error.message);
    
    if (error.code === '28P01') {
      console.log('\n💡 Dicas para resolver o erro de autenticação:');
      console.log('1. Verifique se o PostgreSQL está rodando');
      console.log('2. Verifique as credenciais no arquivo .env');
      console.log('3. Configure o PostgreSQL para aceitar conexões locais');
      console.log('4. Ou use Docker: docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        // Ignorar erros ao fechar conexão
      }
    }
  }
}

// Executar setup
setupDatabase();