// CRUD de materiais (papel, PET, vidro, metais...)
const express = require('express');
const db = require('../db');
const { permitir } = require('../middlewares/auth');
const { ErroHttp, paginacao, listarPaginado, erro } = require('../utils');

const router = express.Router();

function limpar(b) {
    return {
        nome: (b.nome || '').trim(),
        categoria: (b.categoria || '').trim(),
        unidade_padrao: (b.unidade_padrao || 'kg').trim() || 'kg',
        estoque_minimo: Number(b.estoque_minimo) || 0,
        estoque_maximo: Number(b.estoque_maximo) || 0
    };
}

function validar(m) {
    if (!m.nome) throw new ErroHttp(400, 'Nome é obrigatório.');
    if (!m.categoria) throw new ErroHttp(400, 'Categoria é obrigatória.');
    if (m.estoque_minimo < 0 || m.estoque_maximo < 0) throw new ErroHttp(400, 'Limites de estoque não podem ser negativos.');
    if (m.estoque_maximo && m.estoque_maximo < m.estoque_minimo) throw new ErroHttp(400, 'Estoque máximo deve ser maior que o mínimo.');
}

router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        if (req.query.busca) { where.push('nome LIKE ?'); params.push(`%${req.query.busca}%`); }
        if (req.query.categoria) { where.push('categoria = ?'); params.push(req.query.categoria); }
        res.json(await listarPaginado(db, {
            select: '*', from: 'materiais', where, params, order: 'nome'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

router.post('/', async (req, res) => {
    const conn = await db.getConnection();
    try {
        const m = limpar(req.body);
        validar(m);
        await conn.beginTransaction();
        const [r] = await conn.query(
            'INSERT INTO materiais (nome, categoria, unidade_padrao, estoque_minimo, estoque_maximo) VALUES (?, ?, ?, ?, ?)',
            [m.nome, m.categoria, m.unidade_padrao, m.estoque_minimo, m.estoque_maximo]);
        await conn.query('INSERT INTO estoque (material_id, quantidade_kg) VALUES (?, 0)', [r.insertId]);
        await conn.commit();
        res.status(201).json({ id: r.insertId, mensagem: 'Material cadastrado com sucesso!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally {
        conn.release();
    }
});

router.put('/:id', async (req, res) => {
    try {
        const m = limpar(req.body);
        validar(m);
        const [r] = await db.query(
            'UPDATE materiais SET nome = ?, categoria = ?, unidade_padrao = ?, estoque_minimo = ?, estoque_maximo = ? WHERE id = ?',
            [m.nome, m.categoria, m.unidade_padrao, m.estoque_minimo, m.estoque_maximo, req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Material não encontrado.');
        res.json({ mensagem: 'Material atualizado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.delete('/:id', permitir('admin'), async (req, res) => {
    try {
        const [r] = await db.query('DELETE FROM materiais WHERE id = ?', [req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Material não encontrado.');
        res.json({ mensagem: 'Material removido com sucesso!' });
    } catch (e) { erro(res, e); }
});

module.exports = router;
