// Comunicação com o back-end (fetch) e controle da sessão (token JWT)

const Sessao = {
    token: () => localStorage.getItem('token'),
    usuario: () => JSON.parse(localStorage.getItem('usuario') || 'null'),
    salvar(token, usuario) {
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuario));
    },
    limpar() {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
    }
};

// Função única para chamar a API. Lança um Error com a mensagem do servidor se algo der errado.
async function api(url, opcoes = {}) {
    const resp = await fetch('/api' + url, {
        method: opcoes.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(Sessao.token() ? { Authorization: 'Bearer ' + Sessao.token() } : {})
        },
        body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
    });

    if (resp.status === 401 && !url.startsWith('/auth/login')) {
        Sessao.limpar();
        location.reload();
        throw new Error('Sessão expirada.');
    }

    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || 'Erro ao comunicar com o servidor.');
    return dados;
}

// Monta a query string ignorando valores vazios: qs({busca:'a', page:1, x:''}) -> "?busca=a&page=1"
function qs(obj) {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.append(k, v); });
    const s = p.toString();
    return s ? '?' + s : '';
}

// Baixa um arquivo (CSV) respeitando o token de autenticação
async function baixar(url, nomeArquivo) {
    const resp = await fetch('/api' + url, { headers: { Authorization: 'Bearer ' + Sessao.token() } });
    if (!resp.ok) throw new Error('Não foi possível gerar o arquivo.');
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(a.href);
}
