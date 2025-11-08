import { v4 as uuidv4 } from 'uuid';
import config from '../config/app.js';
import logger from '../config/logger.js';

// Importar banco de dados baseado na configuração
let database;
if (config.database.type === 'sqlite') {
  database = await import('../config/database-sqlite.js');
} else {
  database = await import('../config/database.js');
}

const { query: dbQuery, transaction: dbTransaction } = database;

// Normalizar resultado de consultas entre PostgreSQL (result.rows) e SQLite (array direto)
const getRows = (result) => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.rows && Array.isArray(result.rows)) return result.rows;
  return [];
};

// Função para emitir eventos via Socket.IO
const emitPasswordUpdate = (req, event, data) => {
  if (req.io) {
    req.io.emit(event, data);
    logger.info(`Socket.IO event emitted: ${event}`, data);
  }
};

// Gerar nova senha
export const gerarSenha = async (req, res) => {
  try {
    const { 
      tipo = 'normal', 
      prioridade = false, 
      servico = 'geral',
      tipo_checkin = null,
      prioridade_nivel = null
    } = req.body;
    const userId = req.user?.id || null; // Opcional para usuários não autenticados
    
    // Verificar limite de senhas por usuário (apenas se autenticado)
    if (userId) {
      // Ajustar placeholders conforme o banco
      const ph1 = config.database.type === 'sqlite' ? '?' : '$1';
      const ph2 = config.database.type === 'sqlite' ? '?' : '$2';
      const ph3 = config.database.type === 'sqlite' ? '?' : '$3';
      const senhasAtivasResult = await dbQuery(
        `SELECT COUNT(*) as count FROM senhas WHERE user_id = ${ph1} AND status IN (${ph2}, ${ph3})`,
        [userId, 'aguardando', 'chamando']
      );
      const senhasAtivas = getRows(senhasAtivasResult);
      
      if (senhasAtivas[0].count >= config.senhas.maxSenhasPorUsuario) {
        return res.status(429).json({
          success: false,
          message: 'Limite de senhas ativas excedido'
        });
      }
    }
    
    // Obter próximo número da senha (ajuste de cláusula de data conforme banco)
    const dateParam = new Date().toISOString().split('T')[0];
    let ultimaSenhaSql, ultimaSenhaParams;
    if (config.database.type === 'sqlite') {
      const phDate = '?';
      ultimaSenhaSql = `SELECT numero FROM senhas WHERE DATE(created_at) = DATE(${phDate}) ORDER BY numero DESC LIMIT 1`;
      ultimaSenhaParams = [dateParam];
    } else {
      const phDate = '$1';
      ultimaSenhaSql = `SELECT numero FROM senhas WHERE CAST(created_at AS DATE) = CAST(${phDate} AS DATE) ORDER BY numero DESC LIMIT 1`;
      ultimaSenhaParams = [dateParam];
    }
    const ultimaSenhaResult = await dbQuery(ultimaSenhaSql, ultimaSenhaParams);
    const ultimaSenha = getRows(ultimaSenhaResult);
    const proximoNumero = ultimaSenha.length > 0 ? ultimaSenha[0].numero + 1 : config.senhas.numeroInicialSenha;
    
    // Determinar prefixo baseado no tipo composto ou tipo legado
    let prefixo = config.senhas.prefixoSenha;
    if (tipo_checkin && prioridade_nivel) {
      // Usar prefixos específicos para tipos compostos
      const prefixoMap = {
        'proprietario-prioritario': 'PP',
        'proprietario-comum': 'PC',
        'express-prioritario': 'EP',
        'express-comum': 'EC',
        'normal-prioritario': 'NP',
        'normal-comum': 'NC'
      };
      prefixo = prefixoMap[`${tipo_checkin}-${prioridade_nivel}`] || 'A';
    } else {
      // Usar prefixos legados
      const prefixoLegado = {
        'normal': 'N',
        'prioritario': 'P',
        'express': 'E',
        'proprietario': 'PR',
        'check-in': 'CI',
        'check-out': 'CO'
      };
      prefixo = prefixoLegado[tipo] || 'A';
    }
    
    const senhaCompleta = `${prefixo}${proximoNumero.toString().padStart(3, '0')}`;

    // Criar nova senha
    const senhaId = uuidv4();
    const agora = new Date().toISOString();
    
    // Detectar colunas disponíveis na tabela `senhas` para evitar erros em diferentes bancos
    let senhasColumns = [];
    try {
      // Tentar via Information Schema (PostgreSQL)
      const colsPg = await dbQuery(
        "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'senhas'"
      );
      if (Array.isArray(colsPg) && colsPg.length && colsPg[0].name) {
        senhasColumns = colsPg.map((c) => c.name);
      } else if (colsPg?.rows) {
        senhasColumns = colsPg.rows.map((r) => r.name || r.column_name).filter(Boolean);
      }
    } catch (e) {
      // Fallback para SQLite
      try {
        const colsSqlite = await dbQuery('PRAGMA table_info(senhas)');
        if (colsSqlite?.rows) {
          senhasColumns = colsSqlite.rows.map((r) => r.name).filter(Boolean);
        }
      } catch (_) {
        // Ignorar
      }
    }

    // Montar inserção dinamicamente com base nas colunas existentes
    const insertFields = [];
    const insertValues = [];

    const pushIfExists = (col, value) => {
      if (senhasColumns.length === 0 || senhasColumns.includes(col)) {
        insertFields.push(col);
        insertValues.push(value);
      }
    };

    pushIfExists('id', senhaId);
    pushIfExists('numero', proximoNumero);
    pushIfExists('tipo', tipo);
    pushIfExists('status', 'aguardando');
    pushIfExists('created_at', agora);
    pushIfExists('updated_at', agora);
    
    // Campos opcionais dependentes do schema
    pushIfExists('prefixo', prefixo);
    // Mapear prioridade: quando true, usar 'express'; caso contrário, 'comum'
    pushIfExists('prioridade', prioridade ? 'express' : 'comum');
    pushIfExists('user_id', userId);
    pushIfExists('tipo_checkin', tipo_checkin);
    pushIfExists('prioridade_nivel', prioridade_nivel);
    pushIfExists('senha_completa', senhaCompleta);

    // Garantir que há pelo menos os campos essenciais
    if (!insertFields.includes('id') || !insertFields.includes('numero') || !insertFields.includes('tipo')) {
      throw new Error('Estrutura da tabela `senhas` incompatível: campos essenciais ausentes');
    }

    // Construir placeholders conforme o banco
    let placeholders;
    if (config.database.type === 'sqlite') {
      placeholders = insertValues.map(() => '?').join(', ');
    } else {
      placeholders = insertValues.map((_, idx) => `$${idx + 1}`).join(', ');
    }
    await dbQuery(
      `INSERT INTO senhas (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );
    
    // Buscar dados completos da senha criada
    const phId = config.database.type === 'sqlite' ? '?' : '$1';
    const novaSenhaResult = await dbQuery(
      `SELECT * FROM senhas WHERE id = ${phId}`,
      [senhaId]
    );
    const novaSenha = getRows(novaSenhaResult);
    
    // Emitir evento via Socket.IO
    emitPasswordUpdate(req, 'password-generated', {
      password: novaSenha[0],
      queuePosition: await getQueuePosition(senhaId)
    });
    
    res.status(201).json({
      success: true,
      message: 'Senha gerada com sucesso',
      data: {
        password: novaSenha[0],
        queuePosition: await getQueuePosition(senhaId)
      }
    });
    
  } catch (error) {
    logger.error('Erro ao gerar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Obter fila de senhas
export const obterFila = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'aguardando' } = req.query;
    const offset = (page - 1) * limit;
    
    // Query com ordenação melhorada para tipos compostos
    const senhas = await dbQuery(
      `SELECT s.*, u.nome as user_name 
       FROM senhas s 
       LEFT JOIN usuarios u ON s.user_id = u.id 
       WHERE s.status = ? 
       ORDER BY 
         CASE 
           WHEN s.tipo_checkin = 'proprietario' AND s.prioridade_nivel = 'prioritario' THEN 1
           WHEN s.tipo_checkin = 'proprietario' AND s.prioridade_nivel = 'comum' THEN 2
           WHEN s.tipo_checkin = 'express' AND s.prioridade_nivel = 'prioritario' THEN 3
           WHEN s.tipo_checkin = 'express' AND s.prioridade_nivel = 'comum' THEN 4
           WHEN s.tipo_checkin = 'normal' AND s.prioridade_nivel = 'prioritario' THEN 5
           WHEN s.tipo_checkin = 'normal' AND s.prioridade_nivel = 'comum' THEN 6
           WHEN s.tipo = 'proprietario' THEN 2
           WHEN s.tipo = 'prioritario' THEN 5
           WHEN s.tipo = 'express' THEN 4
           ELSE 7
         END,
         s.created_at ASC 
       LIMIT ? OFFSET ?`,
      [status, parseInt(limit), offset]
    );
    
    const total = await dbQuery(
      'SELECT COUNT(*) as count FROM senhas WHERE status = ?',
      [status]
    );
    
    const totalCount = total.rows && total.rows[0] ? total.rows[0].count : 0;
    
    res.json({
      success: true,
      data: {
        passwords: senhas.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao obter fila:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Chamar próxima senha
export const chamarSenha = async (req, res) => {
  try {
    const { id } = req.params;
    const { guiche } = req.body;
    const atendenteId = req.user.id;
    
    // Buscar a senha específica pelo ID
    const proximaSenha = await dbQuery(
      `SELECT s.*, u.nome as user_name 
       FROM senhas s 
       LEFT JOIN usuarios u ON s.user_id = u.id 
       WHERE s.id = ? AND s.status = ?`,
      [id, 'aguardando']
    );
    
    if (proximaSenha.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Senha não encontrada ou não está aguardando'
      });
    }
    
    const senha = proximaSenha.rows[0];
    const agora = new Date().toISOString();
    
    // Atualizar status da senha para 'chamando'
    await dbQuery(
      `UPDATE senhas 
       SET status = ?, guiche = ?, atendente_id = ?, chamada_em = ?, updated_at = ?
       WHERE id = ?`,
      ['chamando', guiche, atendenteId, agora, agora, senha.id]
    );
    
    // Buscar dados atualizados
    const senhaAtualizada = await dbQuery(
      `SELECT s.*, u.nome as user_name, a.nome as atendente_name
       FROM senhas s 
       LEFT JOIN usuarios u ON s.user_id = u.id 
       LEFT JOIN usuarios a ON s.atendente_id = a.id
       WHERE s.id = ?`,
      [senha.id]
    );
    
    // Emitir evento via Socket.IO
    emitPasswordUpdate(req, 'password-called', {
      password: senhaAtualizada.rows[0]
    });
    
    res.json({
      success: true,
      message: 'Senha chamada com sucesso',
      data: {
        password: senhaAtualizada.rows[0]
      }
    });
    
  } catch (error) {
    logger.error('Erro ao chamar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Atender senha
export const atenderSenha = async (req, res) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;
    const atendenteId = req.user.id;
    
    // Verificar se a senha existe e está no status correto
    const senha = await dbQuery(
      'SELECT * FROM senhas WHERE id = ? AND status = ?',
      [id, 'chamando']
    );
    
    if (senha.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Senha não encontrada ou não está no status correto'
      });
    }
    
    const agora = new Date().toISOString();
    
    // Atualizar status da senha para 'atendida'
    await dbQuery(
      `UPDATE senhas 
       SET status = 'atendida', observacoes = ?, atendida_em = ?, updated_at = ?
       WHERE id = ?`,
      [observacoes, agora, agora, id]
    );
    
    // Buscar dados atualizados
    const senhaAtualizada = await dbQuery(
      `SELECT s.*, u.nome as user_name, a.nome as atendente_name
       FROM senhas s 
       LEFT JOIN usuarios u ON s.user_id = u.id 
       LEFT JOIN usuarios a ON s.atendente_id = a.id
       WHERE s.id = ?`,
      [id]
    );
    
    // Emitir evento via Socket.IO
    emitPasswordUpdate(req, 'password-attended', {
      password: senhaAtualizada.rows[0]
    });
    
    res.json({
      success: true,
      message: 'Senha atendida com sucesso',
      data: {
        password: senhaAtualizada.rows[0]
      }
    });
    
  } catch (error) {
    logger.error('Erro ao atender senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Obter detalhes de uma senha
export const obterDetalhes = async (req, res) => {
  try {
    const { id } = req.params;
    
    const senha = await dbQuery(
      `SELECT p.*, u.name as user_name, a.name as atendente_name
       FROM passwords p 
       JOIN users u ON p.user_id = u.id 
       LEFT JOIN users a ON p.atendente_id = a.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (senha.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Senha não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: {
        password: senha[0],
        queuePosition: await getQueuePosition(id)
      }
    });
    
  } catch (error) {
    logger.error('Erro ao obter detalhes da senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Cancelar senha
export const cancelarSenha = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.perfil;
    
    // Verificar se a senha existe
    const senha = await dbQuery(
      'SELECT * FROM passwords WHERE id = ?',
      [id]
    );
    
    if (senha.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Senha não encontrada'
      });
    }
    
    // Verificar permissões (usuário pode cancelar suas próprias senhas, admin/atendente podem cancelar qualquer uma)
    if (senha[0].user_id !== userId && !['admin', 'atendente'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para cancelar esta senha'
      });
    }
    
    // Verificar se a senha pode ser cancelada
    if (!['waiting', 'called'].includes(senha[0].status)) {
      return res.status(400).json({
        success: false,
        message: 'Senha não pode ser cancelada no status atual'
      });
    }
    
    const agora = new Date().toISOString();
    
    // Atualizar status da senha para 'cancelled'
    await dbQuery(
      `UPDATE passwords 
       SET status = 'cancelled', cancelled_at = ?, updated_at = ?
       WHERE id = ?`,
      [agora, agora, id]
    );
    
    // Buscar dados atualizados
    const senhaAtualizada = await dbQuery(
      `SELECT p.*, u.name as user_name, a.name as atendente_name
       FROM passwords p 
       JOIN users u ON p.user_id = u.id 
       LEFT JOIN users a ON p.atendente_id = a.id
       WHERE p.id = ?`,
      [id]
    );
    
    // Emitir evento via Socket.IO
    emitPasswordUpdate(req, 'password-cancelled', {
      password: senhaAtualizada[0]
    });
    
    res.json({
      success: true,
      message: 'Senha cancelada com sucesso',
      data: {
        password: senhaAtualizada[0]
      }
    });
    
  } catch (error) {
    logger.error('Erro ao cancelar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Obter histórico de senhas
export const obterHistorico = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate, userId } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    let params = [];
    
    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    
    if (startDate) {
      whereClause += ' AND DATE(p.created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND DATE(p.created_at) <= ?';
      params.push(endDate);
    }
    
    if (userId) {
      whereClause += ' AND p.user_id = ?';
      params.push(userId);
    }
    
    const senhas = await dbQuery(
      `SELECT p.*, u.name as user_name, a.name as atendente_name
       FROM passwords p 
       JOIN users u ON p.user_id = u.id 
       LEFT JOIN users a ON p.atendente_id = a.id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    
    const total = await dbQuery(
      `SELECT COUNT(*) as count FROM passwords p WHERE ${whereClause}`,
      params
    );
    
    res.json({
      success: true,
      data: {
        passwords: senhas,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total[0].count,
          pages: Math.ceil(total[0].count / limit)
        }
      }
    });
    
  } catch (error) {
    logger.error('Erro ao obter histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Função auxiliar para obter posição na fila
const getQueuePosition = async (senhaId) => {
  try {
    const phId = config.database.type === 'sqlite' ? '?' : '$1';
    const senhaResult = await dbQuery(
      `SELECT created_at, prioridade FROM senhas WHERE id = ${phId}`,
      [senhaId]
    );
    const senha = getRows(senhaResult);
    if (!senha || senha.length === 0 || !senha[0]) return null;
    
    const ph1 = config.database.type === 'sqlite' ? '?' : '$1';
    const ph2 = config.database.type === 'sqlite' ? '?' : '$2';
    const positionResult = await dbQuery(
      `SELECT COUNT(*) as position 
       FROM senhas 
       WHERE status = 'aguardando' 
       AND (
         prioridade = 'express' OR 
         (prioridade = ${ph1} AND created_at < ${ph2})
       )`,
      [senha[0].prioridade, senha[0].created_at]
    );
    const position = getRows(positionResult);
    return position && position[0] ? Number(position[0].position) + 1 : null;
  } catch (error) {
    logger.error('Erro ao calcular posição na fila:', error);
    return null;
  }
};