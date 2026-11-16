// Middlewares de autenticação (JWT) e autorização por perfil
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'ecociclo-chave-de-desenvolvimento';

// Verifica o token enviado no cabeçalho "Authorization: Bearer <token>"
function autenticar(req, res, next) {
    const cabecalho = req.headers.authorization || '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
    if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });
    try {
        req.usuario = jwt.verify(token, SECRET); // { id, nome, perfil, coletor_id }
        next();
    } catch (e) {
        return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
}

// Permite o acesso apenas aos perfis informados. Ex.: permitir('admin', 'operador')
function permitir(...perfis) {
    return (req, res, next) => {
        if (!perfis.includes(req.usuario.perfil)) {
            return res.status(403).json({ erro: 'Você não tem permissão para esta ação.' });
        }
        next();
    };
}

module.exports = { SECRET, autenticar, permitir };
