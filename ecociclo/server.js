// EcoCiclo - servidor principal (Node.js + Express)
require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { autenticar, permitir } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(express.json());                                   // lê JSON do corpo das requisições
app.use(express.static(path.join(__dirname, 'public')));   // serve o front-end (HTML, CSS, JS)

// Rotas públicas
app.use('/api/auth', require('./routes/auth'));

// A partir daqui é necessário estar logado
// admin = tudo | operador = operação do dia a dia | coletor = só consulta as próprias entregas
const ADM_OP = permitir('admin', 'operador');
app.use('/api/usuarios',   autenticar, permitir('admin'), require('./routes/usuarios'));
app.use('/api/coletores',  autenticar, ADM_OP, require('./routes/coletores'));
app.use('/api/materiais',  autenticar, ADM_OP, require('./routes/materiais'));
app.use('/api/precos',     autenticar, ADM_OP, require('./routes/precos'));
app.use('/api/estoque',    autenticar, ADM_OP, require('./routes/estoque'));
app.use('/api/clientes',   autenticar, ADM_OP, require('./routes/clientes'));
app.use('/api/saidas',     autenticar, ADM_OP, require('./routes/saidas'));
app.use('/api/relatorios', autenticar, ADM_OP, require('./routes/relatorios'));
app.use('/api/dashboard',  autenticar, ADM_OP, require('./routes/dashboard'));
app.use('/api/entradas',   autenticar, require('./routes/entradas')); // coletor também acessa (somente leitura das suas)

// Lista simples de coletores/materiais para preencher <select> (inclusive para o perfil coletor, que só vê os seus)
app.get('/api/opcoes', autenticar, async (req, res) => {
    try {
        const [materiais] = await db.query('SELECT id, nome FROM materiais ORDER BY nome');
        const [coletores] = req.usuario.perfil === 'coletor'
            ? await db.query('SELECT id, nome FROM coletores WHERE id = ?', [req.usuario.coletor_id || 0])
            : await db.query("SELECT id, nome, status FROM coletores ORDER BY nome");
        const [clientes] = req.usuario.perfil === 'coletor' ? [[]] : await db.query('SELECT id, razao_social AS nome FROM clientes ORDER BY razao_social');
        res.json({ materiais, coletores, clientes });
    } catch (e) {
        console.error(e);
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});

// Rota inexistente da API
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Cria o administrador padrão na primeira execução
async function criarAdminPadrao() {
    const [rows] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
    if (rows[0].total === 0) {
        await db.query(
            "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, 'admin')",
            ['Administrador', 'admin@ecociclo.com', bcrypt.hashSync('admin123', 10)]);
        console.log('Usuário padrão criado -> admin@ecociclo.com / admin123 (troque a senha!)');
    }
}

app.listen(PORT, async () => {
    console.log(`EcoCiclo rodando em http://localhost:${PORT}`);
    try {
        await criarAdminPadrao();
    } catch (e) {
        console.error('Não foi possível conectar ao banco. Execute o script.sql e confira o arquivo .env.\n', e.message);
    }
});
