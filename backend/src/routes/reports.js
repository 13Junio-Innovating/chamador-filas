import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import config from '../config/app.js';

const router = express.Router();

// Importar dinamicamente o módulo de banco de dados baseado na configuração
let query;
if (config.database.type === 'sqlite') {
  const { query: sqliteQuery } = await import('../config/database-sqlite.js');
  query = sqliteQuery;
} else {
  const { query: pgQuery } = await import('../config/database.js');
  query = pgQuery;
}

// Middleware para autenticação em todas as rotas de relatórios
router.use(authenticateToken);

// Relatório diário
router.get('/daily', requireRole(['admin', 'atendente']), async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Buscar senhas do dia
    const senhas = await query(`
      SELECT 
        id,
        numero,
        tipo,
        status,
        guiche,
        observacoes,
        chamada_em as hora_chamada,
        atendida_em as hora_atendimento,
        atendente_id,
        created_at as hora_retirada
      FROM senhas 
      WHERE DATE(created_at) = ?
      ORDER BY created_at ASC
    `, [targetDate]);

    // Estatísticas do dia
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'atendida' THEN 1 END) as atendidas,
        COUNT(CASE WHEN status = 'chamando' THEN 1 END) as chamadas,
        COUNT(CASE WHEN status = 'aguardando' THEN 1 END) as aguardando,
        COUNT(CASE WHEN tipo = 'normal' THEN 1 END) as normais,
        COUNT(CASE WHEN tipo = 'prioritario' THEN 1 END) as prioritarias,
        COUNT(CASE WHEN tipo = 'express' THEN 1 END) as hospedes,
        AVG(
          CASE 
            WHEN atendida_em IS NOT NULL AND created_at IS NOT NULL 
            THEN (julianday(atendida_em) - julianday(created_at)) * 24 * 60
          END
        ) as tempo_medio_atendimento
      FROM senhas 
      WHERE DATE(created_at) = ?
    `, [targetDate]);

    res.json({
      success: true,
      data: {
        date: targetDate,
        senhas,
        statistics: stats[0]
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatório diário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Relatório mensal
router.get('/monthly', requireRole(['admin']), async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const targetYear = year || new Date().getFullYear().toString();
    
    // Estatísticas mensais por dia
    const dailyStats = await query(`
      SELECT 
        DATE(created_at) as data,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'atendida' THEN 1 END) as atendidas,
        COUNT(CASE WHEN tipo = 'normal' THEN 1 END) as normais,
        COUNT(CASE WHEN tipo = 'prioritario' THEN 1 END) as prioritarias,
        COUNT(CASE WHEN tipo = 'express' THEN 1 END) as hospedes,
        AVG(
          CASE 
            WHEN atendida_em IS NOT NULL AND created_at IS NOT NULL 
            THEN (julianday(atendida_em) - julianday(created_at)) * 24 * 60
          END
        ) as tempo_medio_atendimento
      FROM senhas 
      WHERE strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [targetMonth, targetYear]);

    // Estatísticas gerais do mês
    const monthlyStats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'atendida' THEN 1 END) as atendidas,
        COUNT(CASE WHEN status = 'chamando' THEN 1 END) as chamadas,
        COUNT(CASE WHEN status = 'aguardando' THEN 1 END) as aguardando,
        COUNT(CASE WHEN tipo = 'normal' THEN 1 END) as normais,
        COUNT(CASE WHEN tipo = 'prioritario' THEN 1 END) as prioritarias,
        COUNT(CASE WHEN tipo = 'express' THEN 1 END) as hospedes,
        AVG(
          CASE 
            WHEN atendida_em IS NOT NULL AND created_at IS NOT NULL 
            THEN (julianday(atendida_em) - julianday(created_at)) * 24 * 60
          END
        ) as tempo_medio_atendimento
      FROM senhas 
      WHERE strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?
    `, [targetMonth, targetYear]);

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        dailyStats,
        monthlyStats: monthlyStats[0]
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatório mensal:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Exportar dados para CSV/Excel
router.get('/export', requireRole(['admin', 'atendente']), async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros startDate e endDate são obrigatórios'
      });
    }

    const senhas = await query(`
      SELECT 
        id,
        numero,
        tipo,
        status,
        guiche,
        observacoes,
        chamada_em as hora_chamada,
        atendida_em as hora_atendimento,
        atendente_id,
        created_at as hora_retirada
      FROM senhas 
      WHERE DATE(created_at) BETWEEN ? AND ?
      ORDER BY created_at ASC
    `, [startDate, endDate]);

    if (format === 'csv') {
      // Gerar CSV
      const csvHeader = 'ID,Numero,Tipo,Status,Guiche,Observacoes,Hora_Retirada,Hora_Chamada,Hora_Atendimento,Atendente_ID,Created_At\n';
      const csvRows = senhas.map(senha => 
        `${senha.id},"${senha.numero}","${senha.tipo}","${senha.status}","${senha.guiche || ''}","${senha.observacoes || ''}","${senha.hora_retirada || ''}","${senha.hora_chamada || ''}","${senha.hora_atendimento || ''}","${senha.atendente_id || ''}","${senha.created_at}"`
      ).join('\n');
      
      const csv = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio_${startDate}_${endDate}.csv"`);
      res.send(csv);
    } else {
      // Retornar JSON
      res.json({
        success: true,
        data: {
          startDate,
          endDate,
          total: senhas.length,
          senhas
        }
      });
    }

  } catch (error) {
    console.error('Erro ao exportar dados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Relatório de performance por atendente
router.get('/performance', requireRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const performance = await query(`
      SELECT 
        u.nome as atendente,
        u.email,
        COUNT(s.id) as total_atendimentos,
        AVG(
          CASE 
            WHEN s.atendida_em IS NOT NULL AND s.chamada_em IS NOT NULL 
            THEN (julianday(s.atendida_em) - julianday(s.chamada_em)) * 24 * 60
          END
        ) as tempo_medio_atendimento,
        COUNT(CASE WHEN s.tipo = 'prioritario' THEN 1 END) as prioritarias_atendidas,
        COUNT(CASE WHEN s.tipo = 'express' THEN 1 END) as hospedes_atendidos
      FROM usuarios u
      LEFT JOIN senhas s ON u.id = s.atendente_id 
        AND s.status = 'atendida' 
        AND DATE(s.created_at) BETWEEN ? AND ?
      WHERE u.perfil = 'atendente' AND u.ativo = true
      GROUP BY u.id, u.nome, u.email
      ORDER BY total_atendimentos DESC
    `, [start, end]);

    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        performance
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de performance:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

export default router;