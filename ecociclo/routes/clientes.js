// CRUD de clientes compradores (indústrias)
const express = require('express');
const db = require('../db');
const { permitir } = require('../middlewares/auth');
const { ErroHttp, paginacao, listarPaginado, erro } = require('../utils');

const router = express.Router();

function limpar(b) {
    return {
        razao_social: (b.razao_social || '').trim(),
        cnpj: (b.cnpj || '').replace(/\D/g, ''),
        contato: (b.contato || '').trim(),
        telefone: (b.telefone || '').trim(),
        email: (b.email || '').trim().toLowerCase()
    };
}

function validar(c) {
    if (!c.razao_social) throw new ErroHttp(400, 'Razão social é obrigatória.');
    if (!/^\d{14}$/.test(c.cnpj)) throw new ErroHttp(400, 'CNPJ deve conter 14 dígitos.');
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) throw new ErroHttp(400, 'E-mail inválido.');
}

router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        if (req.query.busca) {
            where.push('(razao_social LIKE ? OR cnpj LIKE ? OR contato LIKE ? OR email LIKE ?)');
            const b = `%${req.query.busca}%`;
            params.push(b, b, b, b);
        }
        res.json(await listarPaginado(db, {
            select: '*', from: 'clientes', where, params, order: 'razao_social'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

router.post('/', async (req, res) => {
    try {
        const c = limpar(req.body);
        validar(c);
        const [r] = await db.query(
            'INSERT INTO clientes (razao_social, cnpj, contato, telefone, email) VALUES (?, ?, ?, ?, ?)',
            [c.razao_social, c.cnpj, c.contato, c.telefone, c.email]);
        res.status(201).json({ id: r.insertId, mensagem: 'Cliente cadastrado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.put('/:id', async (req, res) => {
    try {
        const c = limpar(req.body);
        validar(c);
        const [r] = await db.query(
            'UPDATE clientes SET razao_social = ?, cnpj = ?, contato = ?, telefone = ?, email = ? WHERE id = ?',
            [c.razao_social, c.cnpj, c.contato, c.telefone, c.email, req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Cliente não encontrado.');
        res.json({ mensagem: 'Cliente atualizado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.delete('/:id', permitir('admin'), async (req, res) => {
    try {
        const [r] = await db.query('DELETE FROM clientes WHERE id = ?', [req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Cliente não encontrado.');
        res.json({ mensagem: 'Cliente removido com sucesso!' });
    } catch (e) { erro(res, e); }
});

module.exports = router;
