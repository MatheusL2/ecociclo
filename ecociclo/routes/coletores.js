// CRUD de coletores + histórico de entregas
const express = require('express');
const db = require('../db');
const { permitir } = require('../middlewares/auth');
const { ErroHttp, paginacao, listarPaginado, erro } = require('../utils');

const router = express.Router();

function limpar(b) {
    return {
        nome: (b.nome || '').trim(),
        cpf: (b.cpf || '').replace(/\D/g, ''),
        telefone: (b.telefone || '').trim(),
        endereco: (b.endereco || '').trim(),
        veiculo: (b.veiculo || '').trim(),
        status: b.status === 'inativo' ? 'inativo' : 'ativo'
    };
}

function validar(c) {
    if (!c.nome) throw new ErroHttp(400, 'Nome é obrigatório.');
    if (!/^\d{11}$/.test(c.cpf)) throw new ErroHttp(400, 'CPF deve conter 11 dígitos.');
}

// GET /api/coletores?busca=&status=&page=&limit=
router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        if (req.query.busca) {
            where.push('(nome LIKE ? OR cpf LIKE ? OR telefone LIKE ?)');
            const texto = `%${req.query.busca}%`;
            const digitos = req.query.busca.replace(/\D/g, '');      // CPF é salvo só com números
            params.push(texto, digitos ? `%${digitos}%` : texto, texto);
        }
        if (req.query.status) { where.push('status = ?'); params.push(req.query.status); }
        res.json(await listarPaginado(db, {
            select: '*', from: 'coletores', where, params, order: 'nome'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

// GET /api/coletores/:id  -> dados + histórico de entregas
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM coletores WHERE id = ?', [req.params.id]);
        if (!rows[0]) throw new ErroHttp(404, 'Coletor não encontrado.');
        const [entregas] = await db.query(
            `SELECT e.id, e.data_hora, m.nome AS material, e.peso_kg, e.preco_kg, e.valor_total, e.pago
             FROM entradas e JOIN materiais m ON m.id = e.material_id
             WHERE e.coletor_id = ? ORDER BY e.data_hora DESC, e.id DESC LIMIT 100`, [req.params.id]);
        const [[totais]] = await db.query(
            `SELECT COUNT(*) AS entregas, COALESCE(SUM(peso_kg),0) AS peso_kg, COALESCE(SUM(valor_total),0) AS valor_total,
                    COALESCE(SUM(CASE WHEN pago = 0 THEN valor_total END),0) AS a_pagar
             FROM entradas WHERE coletor_id = ?`, [req.params.id]);
        res.json({ coletor: rows[0], entregas, totais });
    } catch (e) { erro(res, e); }
});

router.post('/', async (req, res) => {
    try {
        const c = limpar(req.body);
        validar(c);
        const [r] = await db.query(
            'INSERT INTO coletores (nome, cpf, telefone, endereco, veiculo, status) VALUES (?, ?, ?, ?, ?, ?)',
            [c.nome, c.cpf, c.telefone, c.endereco, c.veiculo, c.status]);
        res.status(201).json({ id: r.insertId, mensagem: 'Coletor cadastrado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.put('/:id', async (req, res) => {
    try {
        const c = limpar(req.body);
        validar(c);
        const [r] = await db.query(
            'UPDATE coletores SET nome = ?, cpf = ?, telefone = ?, endereco = ?, veiculo = ?, status = ? WHERE id = ?',
            [c.nome, c.cpf, c.telefone, c.endereco, c.veiculo, c.status, req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Coletor não encontrado.');
        res.json({ mensagem: 'Coletor atualizado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.delete('/:id', permitir('admin'), async (req, res) => {
    try {
        const [r] = await db.query('DELETE FROM coletores WHERE id = ?', [req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Coletor não encontrado.');
        res.json({ mensagem: 'Coletor removido com sucesso!' });
    } catch (e) { erro(res, e); }
});

module.exports = router;
