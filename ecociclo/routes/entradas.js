// Entradas (coletas): o coletor entrega o material, o sistema calcula o valor e atualiza o estoque
const express = require('express');
const db = require('../db');
const { permitir } = require('../middlewares/auth');
const { ErroHttp, paginacao, listarPaginado, erro, arredondar } = require('../utils');

const router = express.Router();

const FROM = `entradas e
    JOIN coletores c ON c.id = e.coletor_id
    JOIN materiais m ON m.id = e.material_id`;
const SELECT = `e.id, e.coletor_id, c.nome AS coletor, e.material_id, m.nome AS material,
    e.peso_kg, e.preco_kg, e.valor_total, e.data_hora, e.pago, e.data_pagamento`;

// Preço vigente do material na data informada
async function precoVigente(conn, materialId, data) {
    const [rows] = await conn.query(
        `SELECT valor_kg FROM precos WHERE material_id = ? AND data_vigencia <= DATE(COALESCE(?, NOW()))
         ORDER BY data_vigencia DESC, id DESC LIMIT 1`, [materialId, data]);
    if (!rows[0]) throw new ErroHttp(400, 'Este material não possui preço cadastrado para a data da coleta.');
    return rows[0].valor_kg;
}

// Soma (ou subtrai) kg no estoque garantindo que nunca fique negativo
async function ajustarEstoque(conn, materialId, deltaKg) {
    await conn.query('INSERT IGNORE INTO estoque (material_id, quantidade_kg) VALUES (?, 0)', [materialId]);
    const [r] = await conn.query(
        'UPDATE estoque SET quantidade_kg = quantidade_kg + ? WHERE material_id = ? AND quantidade_kg + ? >= 0',
        [deltaKg, materialId, deltaKg]);
    if (!r.affectedRows) throw new ErroHttp(409, 'Estoque insuficiente para esta operação.');
}

function dataSql(d) {
    if (!d) return null; // null -> o banco usa NOW() (mesmo relógio do pagamento)
    const s = String(d).replace('T', ' ');
    return s.length === 16 ? s + ':00' : s;
}

function validar(b) {
    if (!Number(b.coletor_id)) throw new ErroHttp(400, 'Selecione o coletor.');
    if (!Number(b.material_id)) throw new ErroHttp(400, 'Selecione o material.');
    if (!(Number(b.peso_kg) > 0)) throw new ErroHttp(400, 'O peso deve ser maior que zero.');
}

async function validarColetorAtivo(conn, id) {
    const [rows] = await conn.query('SELECT status FROM coletores WHERE id = ?', [id]);
    if (!rows[0]) throw new ErroHttp(400, 'Coletor não encontrado.');
    if (rows[0].status !== 'ativo') throw new ErroHttp(400, 'Coletor inativo não pode registrar entregas.');
}

// GET /api/entradas?busca=&coletor_id=&material_id=&inicio=&fim=&pago=&page=
// (perfil "coletor" enxerga apenas as próprias entregas)
router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        const coletorId = req.usuario.perfil === 'coletor' ? req.usuario.coletor_id || 0 : req.query.coletor_id;
        if (coletorId) { where.push('e.coletor_id = ?'); params.push(coletorId); }
        if (req.query.material_id) { where.push('e.material_id = ?'); params.push(req.query.material_id); }
        if (req.query.inicio) { where.push('DATE(e.data_hora) >= ?'); params.push(req.query.inicio); }
        if (req.query.fim) { where.push('DATE(e.data_hora) <= ?'); params.push(req.query.fim); }
        if (req.query.pago === '0' || req.query.pago === '1') { where.push('e.pago = ?'); params.push(req.query.pago); }
        if (req.query.busca) {
            where.push('(c.nome LIKE ? OR m.nome LIKE ?)');
            params.push(`%${req.query.busca}%`, `%${req.query.busca}%`);
        }
        res.json(await listarPaginado(db, {
            select: SELECT, from: FROM, where, params, order: 'e.data_hora DESC, e.id DESC'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

// GET /api/entradas/:id/comprovante
router.get('/:id/comprovante', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ${SELECT}, c.cpf, c.telefone, u.nome AS operador
             FROM ${FROM} LEFT JOIN usuarios u ON u.id = e.usuario_id WHERE e.id = ?`, [req.params.id]);
        const e = rows[0];
        if (!e) throw new ErroHttp(404, 'Entrega não encontrada.');
        if (req.usuario.perfil === 'coletor' && e.coletor_id !== req.usuario.coletor_id) {
            throw new ErroHttp(403, 'Você não tem permissão para ver este comprovante.');
        }
        res.json(e);
    } catch (e) { erro(res, e); }
});

// POST /api/entradas  (admin e operador)
router.post('/', permitir('admin', 'operador'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        validar(req.body);
        const peso = arredondar(req.body.peso_kg, 3);
        const dataHora = dataSql(req.body.data_hora);
        await conn.beginTransaction();
        await validarColetorAtivo(conn, req.body.coletor_id);
        const preco = await precoVigente(conn, req.body.material_id, dataHora);
        const total = arredondar(peso * preco, 2);
        const [r] = await conn.query(
            `INSERT INTO entradas (coletor_id, material_id, peso_kg, preco_kg, valor_total, data_hora, usuario_id)
             VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW()), ?)`,
            [req.body.coletor_id, req.body.material_id, peso, preco, total, dataHora, req.usuario.id]);
        await ajustarEstoque(conn, req.body.material_id, peso);
        await conn.commit();
        res.status(201).json({ id: r.insertId, valor_total: total, mensagem: 'Coleta registrada e estoque atualizado!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally { conn.release(); }
});

// PUT /api/entradas/:id  (admin e operador) - corrige a entrega e reajusta o estoque
router.put('/:id', permitir('admin', 'operador'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        validar(req.body);
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT * FROM entradas WHERE id = ? FOR UPDATE', [req.params.id]);
        const antiga = rows[0];
        if (!antiga) throw new ErroHttp(404, 'Entrega não encontrada.');
        if (antiga.pago) throw new ErroHttp(409, 'Entrega já paga não pode ser alterada.');

        const peso = arredondar(req.body.peso_kg, 3);
        const dataHora = req.body.data_hora ? dataSql(req.body.data_hora) : antiga.data_hora;
        await validarColetorAtivo(conn, req.body.coletor_id);
        const preco = await precoVigente(conn, req.body.material_id, dataHora);
        const total = arredondar(peso * preco, 2);

        if (antiga.material_id === Number(req.body.material_id)) {
            await ajustarEstoque(conn, antiga.material_id, peso - antiga.peso_kg); // mesmo material: só a diferença
        } else {
            await ajustarEstoque(conn, antiga.material_id, -antiga.peso_kg);       // desfaz a entrada antiga
            await ajustarEstoque(conn, req.body.material_id, peso);                // aplica a nova
        }
        await conn.query(
            `UPDATE entradas SET coletor_id = ?, material_id = ?, peso_kg = ?, preco_kg = ?, valor_total = ?, data_hora = ?
             WHERE id = ?`,
            [req.body.coletor_id, req.body.material_id, peso, preco, total, dataHora, req.params.id]);
        await conn.commit();
        res.json({ mensagem: 'Entrega atualizada e estoque reajustado!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally { conn.release(); }
});

// PUT /api/entradas/:id/pagar  - registra o pagamento ao coletor
router.put('/:id/pagar', permitir('admin', 'operador'), async (req, res) => {
    try {
        const [r] = await db.query(
            'UPDATE entradas SET pago = 1, data_pagamento = NOW() WHERE id = ? AND pago = 0', [req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(409, 'Entrega não encontrada ou já paga.');
        res.json({ mensagem: 'Pagamento registrado com sucesso!' });
    } catch (e) { erro(res, e); }
});

// DELETE /api/entradas/:id  (admin) - remove a entrega e baixa o estoque
router.delete('/:id', permitir('admin'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT * FROM entradas WHERE id = ? FOR UPDATE', [req.params.id]);
        const e = rows[0];
        if (!e) throw new ErroHttp(404, 'Entrega não encontrada.');
        if (e.pago) throw new ErroHttp(409, 'Entrega já paga não pode ser excluída.');
        await ajustarEstoque(conn, e.material_id, -e.peso_kg);
        await conn.query('DELETE FROM entradas WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ mensagem: 'Entrega removida e estoque ajustado!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally { conn.release(); }
});

module.exports = router;
