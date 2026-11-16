// CRUD de usuários (somente perfil admin - controlado no server.js)
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ErroHttp, paginacao, listarPaginado, erro } = require('../utils');

const router = express.Router();
const PERFIS = ['admin', 'operador', 'coletor'];

function validar(b, criando) {
    if (!b.nome || !b.nome.trim()) throw new ErroHttp(400, 'Nome é obrigatório.');
    if (!b.email || !/^\S+@\S+\.\S+$/.test(b.email)) throw new ErroHttp(400, 'E-mail inválido.');
    if (!PERFIS.includes(b.perfil)) throw new ErroHttp(400, 'Perfil inválido.');
    if ((criando || b.senha) && (!b.senha || b.senha.length < 6)) throw new ErroHttp(400, 'A senha deve ter ao menos 6 caracteres.');
    if (b.perfil === 'coletor' && !b.coletor_id) throw new ErroHttp(400, 'Usuário do tipo coletor deve estar vinculado a um coletor.');
}

router.get('/', async (req, res) => {
    try {
        const where = [], params = [];
        if (req.query.busca) {
            where.push('(nome LIKE ? OR email LIKE ?)');
            params.push(`%${req.query.busca}%`, `%${req.query.busca}%`);
        }
        if (req.query.perfil) { where.push('perfil = ?'); params.push(req.query.perfil); }
        res.json(await listarPaginado(db, {
            select: 'id, nome, email, perfil, coletor_id, ativo',
            from: 'usuarios', where, params, order: 'nome'
        }, paginacao(req)));
    } catch (e) { erro(res, e); }
});

router.post('/', async (req, res) => {
    try {
        const b = req.body;
        validar(b, true);
        const [r] = await db.query(
            'INSERT INTO usuarios (nome, email, senha_hash, perfil, coletor_id, ativo) VALUES (?, ?, ?, ?, ?, ?)',
            [b.nome.trim(), b.email.trim().toLowerCase(), bcrypt.hashSync(b.senha, 10), b.perfil,
             b.perfil === 'coletor' ? +b.coletor_id : null, b.ativo === 0 || b.ativo === '0' ? 0 : 1]
        );
        res.status(201).json({ id: r.insertId, mensagem: 'Usuário criado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.put('/:id', async (req, res) => {
    try {
        const b = req.body;
        validar(b, false);
        if (+req.params.id === req.usuario.id && (b.ativo === 0 || b.ativo === '0')) {
            throw new ErroHttp(400, 'Você não pode desativar o próprio usuário.');
        }
        const campos = ['nome = ?', 'email = ?', 'perfil = ?', 'coletor_id = ?', 'ativo = ?'];
        const params = [b.nome.trim(), b.email.trim().toLowerCase(), b.perfil,
                        b.perfil === 'coletor' ? +b.coletor_id : null, b.ativo === 0 || b.ativo === '0' ? 0 : 1];
        if (b.senha) { campos.push('senha_hash = ?'); params.push(bcrypt.hashSync(b.senha, 10)); }
        const [r] = await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...params, req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Usuário não encontrado.');
        res.json({ mensagem: 'Usuário atualizado com sucesso!' });
    } catch (e) { erro(res, e); }
});

router.delete('/:id', async (req, res) => {
    try {
        if (+req.params.id === req.usuario.id) throw new ErroHttp(400, 'Você não pode excluir o próprio usuário.');
        const [r] = await db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        if (!r.affectedRows) throw new ErroHttp(404, 'Usuário não encontrado.');
        res.json({ mensagem: 'Usuário removido com sucesso!' });
    } catch (e) { erro(res, e); }
});

module.exports = router;
