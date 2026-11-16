// Saídas (vendas de lotes para indústrias) com baixa no estoque
const express = require('express');
const db = require('../db');
const { permitir } = require('../middlewares/auth');
const { ErroHttp, paginacao, listarPaginado, erro, arredondar } = require('../utils');

const router = express.Router();

const FROM = `saidas s
    JOIN clientes c ON c.id = s.cliente_id
    JOIN materiais m ON m.id = s.material_id`;
const SELECT = `s.id, s.cliente_id, c.razao_social AS cliente, s.material_id, m.nome AS material,
    s.peso_kg, s.valor_kg, s.valor_total, s.data_hora`;

async function ajustarEstoque(conn, materialId, deltaKg) {
    await conn.query('INSERT IGNORE INTO estoque (material_id, quantidade_kg) VALUES (?, 0)', [materialId]);
    const [r] = await conn.query(
        'UPDATE estoque SET quantidade_kg = quantidade_kg + ? WHERE material_id = ? AND quantidade_kg + ? >= 0',
        [deltaKg, materialId, deltaKg]);
    if (!r.affectedRows) throw new ErroHttp(409, 'Estoque insuficiente para esta venda.');
}

function validar(b) {
    if (!Number(b.cliente_id)) throw new ErroHttp(400, 'Selecione o cliente.');
    if (!Number(b.material_id)) throw new ErroHttp(400, 'Selecione o material.');
    if (!(Number(b.peso_kg) > 0)) throw new ErroHttp(400, 'O peso deve ser maior que zero.');
    if (!(Number(b.valor_kg) > 0)) throw new ErroHttp(400, 'O valor por kg deve ser maior que zero.');
}

function dataSql(d) {
    if (!d) return null; // null -> o banco usa NOW() (mesmo relógio do pagamento)
    const s = String(d).replace('T', ' ');
    return s.length === 16 ? s + ':00' : s;
}

router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        if (req.query.cliente_id) { where.push('s.cliente_id = ?'); params.push(req.query.cliente_id); }
        if (req.query.material_id) { where.push('s.material_id = ?'); params.push(req.query.material_id); }
        if (req.query.inicio) { where.push('DATE(s.data_hora) >= ?'); params.push(req.query.inicio); }
        if (req.query.fim) { where.push('DATE(s.data_hora) <= ?'); params.push(req.query.fim); }
        if (req.query.busca) {
            where.push('(c.razao_social LIKE ? OR m.nome LIKE ?)');
            params.push(`%${req.query.busca}%`, `%${req.query.busca}%`);
        }
        res.json(await listarPaginado(db, {
            select: SELECT, from: FROM, where, params, order: 's.data_hora DESC, s.id DESC'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

router.post('/', async (req, res) => {
    const conn = await db.getConnection();
    try {
        validar(req.body);
        const peso = arredondar(req.body.peso_kg, 3);
        const valorKg = arredondar(req.body.valor_kg, 2);
        await conn.beginTransaction();
        await ajustarEstoque(conn, req.body.material_id, -peso);
        const [r] = await conn.query(
            `INSERT INTO saidas (cliente_id, material_id, peso_kg, valor_kg, valor_total, data_hora, usuario_id)
             VALUES (?, ?, ?, ?, ?, COALESCE(?, NOW()), ?)`,
            [req.body.cliente_id, req.body.material_id, peso, valorKg, arredondar(peso * valorKg, 2),
             dataSql(req.body.data_hora), req.usuario.id]);
        await conn.commit();
        res.status(201).json({ id: r.insertId, mensagem: 'Venda registrada e estoque baixado!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally { conn.release(); }
});

router.put('/:id', async (req, res) => {
    const conn = await db.getConnection();
    try {
        validar(req.body);
        const peso = arredondar(req.body.peso_kg, 3);
        const valorKg = arredondar(req.body.valor_kg, 2);
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT * FROM saidas WHERE id = ? FOR UPDATE', [req.params.id]);
        const antiga = rows[0];
        if (!antiga) throw new ErroHttp(404, 'Venda não encontrada.');
        if (antiga.material_id === Number(req.body.material_id)) {
            await ajustarEstoque(conn, antiga.material_id, antiga.peso_kg - peso); // mesmo material: só a diferença
        } else {
            await ajustarEstoque(conn, antiga.material_id, +antiga.peso_kg);       // devolve ao estoque
            await ajustarEstoque(conn, req.body.material_id, -peso);               // baixa a nova quantidade
        }
        await conn.query(
            `UPDATE saidas SET cliente_id = ?, material_id = ?, peso_kg = ?, valor_kg = ?, valor_total = ?, data_hora = ?
             WHERE id = ?`,
            [req.body.cliente_id, req.body.material_id, peso, valorKg, arredondar(peso * valorKg, 2),
             req.body.data_hora ? dataSql(req.body.data_hora) : antiga.data_hora, req.params.id]);
        await conn.commit();
        res.json({ mensagem: 'Venda atualizada e estoque reajustado!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally { conn.release(); }
});

router.delete('/:id', permitir('admin'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT * FROM saidas WHERE id = ? FOR UPDATE', [req.params.id]);
        if (!rows[0]) throw new ErroHttp(404, 'Venda não encontrada.');
        await ajustarEstoque(conn, rows[0].material_id, +rows[0].peso_kg); // estorna ao estoque
        await conn.query('DELETE FROM saidas WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ mensagem: 'Venda removida e estoque estornado!' });
    } catch (e) {
        await conn.rollback();
        erro(res, e);
    } finally { conn.release(); }
});

module.exports = router;
