// Funções auxiliares usadas por várias rotas

// Erro com código HTTP (ex.: 400, 404, 409) para mensagens amigáveis ao usuário
class ErroHttp extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

// Lê ?page= e ?limit= da URL e calcula o deslocamento (offset)
function paginacao(req) {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    return { page, limit, offset: (page - 1) * limit };
}

// Executa um SELECT paginado e devolve { dados, total, page, limit, paginas }
async function listarPaginado(db, { select, from, where = [], params = [], order }, pag) {
    const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ${from}${w}`, params);
    const [dados] = await db.query(
        `SELECT ${select} FROM ${from}${w} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [...params, pag.limit, pag.offset]
    );
    return { dados, total, page: pag.page, limit: pag.limit, paginas: Math.ceil(total / pag.limit) || 1 };
}

// Trata erros de forma padronizada nas rotas
function erro(res, err) {
    if (err instanceof ErroHttp) return res.status(err.status).json({ erro: err.message });
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe um registro com esses dados (valor duplicado).' });
    if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ erro: 'Este registro possui vínculos (entradas, saídas, etc.) e não pode ser excluído.' });
    console.error(err);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
}

// Arredonda para n casas decimais
const arredondar = (v, n = 2) => Math.round((Number(v) + Number.EPSILON) * 10 ** n) / 10 ** n;

// Converte uma lista de objetos em CSV (separador ";")
function paraCsv(colunas, linhas) {
    const esc = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'number') return String(v).replace('.', ',');
        const s = String(v);
        return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cab = colunas.map((c) => esc(c.titulo)).join(';');
    const corpo = linhas.map((l) => colunas.map((c) => esc(l[c.campo])).join(';'));
    return '﻿' + [cab, ...corpo].join('\r\n');
}

module.exports = { ErroHttp, paginacao, listarPaginado, erro, arredondar, paraCsv };
