// Relatórios por período, material, coletor (JSON, CSV para Excel; PDF via impressão no front)
const express = require('express');
const db = require('../db');
const { ErroHttp, erro, paraCsv } = require('../utils');

const router = express.Router();

const TIPOS = {
    entradas: {
        titulo: 'Relatório de Entradas (Coletas)',
        sql: `SELECT e.id, DATE_FORMAT(e.data_hora, '%d/%m/%Y %H:%i') AS data, c.nome AS coletor, m.nome AS material,
                     e.peso_kg, e.preco_kg, e.valor_total, IF(e.pago, 'Pago', 'Pendente') AS pagamento
              FROM entradas e JOIN coletores c ON c.id = e.coletor_id JOIN materiais m ON m.id = e.material_id`,
        filtros: { data: 'DATE(e.data_hora)', coletor_id: 'e.coletor_id', material_id: 'e.material_id' },
        ordem: 'e.data_hora DESC, e.id DESC',
        colunas: [
            { campo: 'id', titulo: 'Nº' }, { campo: 'data', titulo: 'Data' }, { campo: 'coletor', titulo: 'Coletor' },
            { campo: 'material', titulo: 'Material' }, { campo: 'peso_kg', titulo: 'Peso (kg)' },
            { campo: 'preco_kg', titulo: 'Preço/kg' }, { campo: 'valor_total', titulo: 'Valor total' },
            { campo: 'pagamento', titulo: 'Pagamento' }
        ],
        total: ['peso_kg', 'valor_total']
    },
    saidas: {
        titulo: 'Relatório de Saídas (Vendas)',
        sql: `SELECT s.id, DATE_FORMAT(s.data_hora, '%d/%m/%Y %H:%i') AS data, c.razao_social AS cliente, m.nome AS material,
                     s.peso_kg, s.valor_kg, s.valor_total
              FROM saidas s JOIN clientes c ON c.id = s.cliente_id JOIN materiais m ON m.id = s.material_id`,
        filtros: { data: 'DATE(s.data_hora)', material_id: 's.material_id', cliente_id: 's.cliente_id' },
        ordem: 's.data_hora DESC, s.id DESC',
        colunas: [
            { campo: 'id', titulo: 'Nº' }, { campo: 'data', titulo: 'Data' }, { campo: 'cliente', titulo: 'Cliente' },
            { campo: 'material', titulo: 'Material' }, { campo: 'peso_kg', titulo: 'Peso (kg)' },
            { campo: 'valor_kg', titulo: 'Valor/kg' }, { campo: 'valor_total', titulo: 'Valor total' }
        ],
        total: ['peso_kg', 'valor_total']
    },
    estoque: {
        titulo: 'Relatório de Estoque',
        sql: `SELECT m.nome AS material, m.categoria, COALESCE(e.quantidade_kg,0) AS quantidade_kg,
                     ROUND(COALESCE(e.quantidade_kg,0)/1000, 3) AS toneladas
              FROM materiais m LEFT JOIN estoque e ON e.material_id = m.id`,
        filtros: { material_id: 'm.id' },
        ordem: 'm.nome',
        colunas: [
            { campo: 'material', titulo: 'Material' }, { campo: 'categoria', titulo: 'Categoria' },
            { campo: 'quantidade_kg', titulo: 'Quantidade (kg)' }, { campo: 'toneladas', titulo: 'Toneladas' }
        ],
        total: ['quantidade_kg', 'toneladas']
    }
};

// GET /api/relatorios/:tipo?inicio=&fim=&material_id=&coletor_id=&cliente_id=&formato=json|csv
router.get('/:tipo', async (req, res) => {
    try {
        const t = TIPOS[req.params.tipo];
        if (!t) throw new ErroHttp(404, 'Tipo de relatório inexistente.');

        const where = [], params = [];
        if (t.filtros.data) {
            if (req.query.inicio) { where.push(`${t.filtros.data} >= ?`); params.push(req.query.inicio); }
            if (req.query.fim) { where.push(`${t.filtros.data} <= ?`); params.push(req.query.fim); }
        }
        for (const f of ['coletor_id', 'material_id', 'cliente_id']) {
            if (t.filtros[f] && req.query[f]) { where.push(`${t.filtros[f]} = ?`); params.push(req.query[f]); }
        }

        const [linhas] = await db.query(
            `${t.sql}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${t.ordem}`, params);

        const totais = {};
        t.total.forEach((c) => { totais[c] = Math.round(linhas.reduce((s, l) => s + Number(l[c]), 0) * 1000) / 1000; });

        if (req.query.formato === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.tipo}.csv"`);
            return res.send(paraCsv(t.colunas, linhas));
        }
        res.json({ titulo: t.titulo, colunas: t.colunas, linhas, totais });
    } catch (e) { erro(res, e); }
});

module.exports = router;
