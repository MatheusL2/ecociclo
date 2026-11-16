// Preços por kg de cada material, com histórico por data
const express = require('express');
const db = require('../db');
const { permitir } = require('../middlewares/auth');
const { ErroHttp, paginacao, listarPaginado, erro } = require('../utils');

const router = express.Router();

// GET /api/precos/atual -> preço vigente de cada material
router.get('/atual', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT m.id AS material_id, m.nome AS material, p.valor_kg, p.data_vigencia
             FROM materiais m
             LEFT JOIN precos p ON p.id = (
                 SELECT p2.id FROM precos p2
                 WHERE p2.material_id = m.id AND p2.data_vigencia <= CURDATE()
                 ORDER BY p2.data_vigencia DESC, p2.id DESC LIMIT 1)
             ORDER BY m.nome`);
        res.json(rows);
    } catch (e) { erro(res, e); }
});

// GET /api/precos?material_id=&page=  -> histórico com variação em relação ao preço anterior
router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        if (req.query.material_id) { where.push('t.material_id = ?'); params.push(req.query.material_id); }
        res.json(await listarPaginado(db, {
            select: 't.id, t.material_id, t.material, t.valor_kg, t.data_vigencia, t.variacao',
            from: `(SELECT p.id, p.material_id, m.nome AS material, p.valor_kg, p.data_vigencia,
                           ROUND(p.valor_kg - LAG(p.valor_kg) OVER (PARTITION BY p.material_id ORDER BY p.data_vigencia, p.id), 2) AS variacao
                    FROM precos p JOIN materiais m ON m.id = p.material_id) t`,
            where, params, order: 't.data_vigencia DESC, t.id DESC'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

router.post('/', async (req, res) => {
    try {
        const material_id = Number(req.body.material_id);
        const valor_kg = Number(req.body.valor_kg);
        const data = req.body.data_vigencia || new Date().toISOString().slice(0, 10);
        if (!material_id) throw new ErroHttp(400, 'Selecione o material.');
        if (!(valor_kg > 0)) throw new ErroHttp(400, 'O valor por kg deve ser maior que zero.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroHttp(400, 'Data de vigência inválida.');
        const [r] = await db.query(
            'INSERT INTO precos (material_id, valor_kg, data_vigencia) VALUES (?, ?, ?)', [material_id, valor_kg, data]);
        res.status(201).json({ id: r.insertId, mensagem: 'Preço registrado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.delete('/:id', permitir('admin'), async (req, res) => {
    try {
        const [r] = await db.query('DELETE FROM precos WHERE id = ?', [req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Preço não encontrado.');
        res.json({ mensagem: 'Preço removido com sucesso!' });
    } catch (e) { erro(res, e); }
});

module.exports = router;
