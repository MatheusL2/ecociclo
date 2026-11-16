// Controle principal: login, menu por perfil e navegação entre páginas

const MENU = [
    { id: 'dashboard',  nome: '📊 Painel',     perfis: ['admin', 'operador'] },
    { id: 'entradas',   nome: '⬇ Entradas',    perfis: ['admin', 'operador', 'coletor'] },
    { id: 'saidas',     nome: '⬆ Saídas',      perfis: ['admin', 'operador'] },
    { id: 'estoque',    nome: '📦 Estoque',    perfis: ['admin', 'operador'] },
    { id: 'coletores',  nome: '🧑 Coletores',  perfis: ['admin', 'operador'] },
    { id: 'materiais',  nome: '♻ Materiais',   perfis: ['admin', 'operador'] },
    { id: 'precos',     nome: '💲 Preços',     perfis: ['admin', 'operador'] },
    { id: 'clientes',   nome: '🏭 Clientes',   perfis: ['admin', 'operador'] },
    { id: 'relatorios', nome: '📄 Relatórios', perfis: ['admin', 'operador'] },
    { id: 'usuarios',   nome: '🔐 Usuários',   perfis: ['admin'] }
];

function iniciarApp() {
    const usuario = Sessao.usuario();
    $('#tela-login').classList.add('oculto');
    $('#tela-app').classList.remove('oculto');
    $('#usuario-nome').textContent = usuario.nome;
    $('#usuario-perfil').textContent = usuario.perfil;

    const itens = MENU.filter((m) => m.perfis.includes(usuario.perfil));
    $('#menu').innerHTML = itens.map((m) => `<a data-pagina="${m.id}">${m.nome}</a>`).join('');
    $('#menu').onclick = (ev) => { const a = ev.target.closest('a'); if (a) abrirPagina(a.dataset.pagina); };

    abrirPagina(itens[0].id);
}

async function abrirPagina(id) {
    const usuario = Sessao.usuario();
    const item = MENU.find((m) => m.id === id);
    document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.pagina === id));
    $('#titulo-pagina').textContent = item.nome.replace(/^\S+\s/, '');
    $('#conteudo').onclick = null;
    $('#conteudo').innerHTML = '<p class="vazio">Carregando...</p>';
    try {
        await PAGINAS[id](usuario);
    } catch (e) {
        $('#conteudo').innerHTML = `<p class="vazio">${esc(e.message)}</p>`;
    }
}

// ---------- Login / logout ----------
$('#form-login').onsubmit = async (ev) => {
    ev.preventDefault();
    $('#login-erro').textContent = '';
    try {
        const r = await api('/auth/login', { method: 'POST', body: { email: $('#login-email').value, senha: $('#login-senha').value } });
        Sessao.salvar(r.token, r.usuario);
        iniciarApp();
    } catch (e) { $('#login-erro').textContent = e.message; }
};
$('#btn-sair').onclick = () => { Sessao.limpar(); location.reload(); };

// Fecha o modal ao clicar fora da caixa
$('#modal').addEventListener('mousedown', (ev) => { if (ev.target.id === 'modal') fecharModal(); });

// Se já há sessão salva, entra direto
if (Sessao.token() && Sessao.usuario()) iniciarApp();
