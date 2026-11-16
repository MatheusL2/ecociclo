const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { erro } = require('../utils');
const { SECRET, autenticar } = require('../middlewares/auth');

const router = express.Router();

// POST /api/auth/login  -> { token, usuario }
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });

        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email.trim().toLowerCase()]);
        const u = rows[0];
        if (!u || !bcrypt.compareSync(senha, u.senha_hash)) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const usuario = { id: u.id, nome: u.nome, perfil: u.perfil, coletor_id: u.coletor_id };
        const token = jwt.sign(usuario, SECRET, { expiresIn: '8h' });
        res.json({ token, usuario });
    } catch (e) {
        erro(res, e);
    }
});

// GET /api/auth/me -> dados do usuário logado
router.get('/me', autenticar, (req, res) => res.json(req.usuario));

module.exports = router;
