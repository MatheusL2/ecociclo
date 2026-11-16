// Funções de interface reutilizáveis: formatação, toast, modal, tabela com paginação e CRUD genérico

const $ = (sel, raiz = document) => raiz.querySelector(sel);

// ---------- Formatação ----------
const fmt = {
    moeda: (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    kg: (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' kg',
    num: (v, d = 3) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d }),
    data: (s) => {
        if (!s) return '';
        const [d, h] = String(s).split(' ');
        const [a, m, di] = d.split('-');
        return `${di}/${m}/${a}` + (h ? ' ' + h.slice(0, 5) : '');
    },
    cpf: (s) => String(s || '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'),
    cnpj: (s) => String(s || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
};

// Evita injeção de HTML ao mostrar texto digitado pelo usuário
function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Toast ----------
let toastTimer;
function toast(msg, ehErro = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('erro-toast', ehErro);
    t.classList.remove('oculto');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('oculto'), 3500);
}

// ---------- Modal ----------
function abrirModal(titulo, html) {
    $('#modal-titulo').textContent = titulo;
    $('#modal-corpo').innerHTML = html;
    $('#modal').classList.remove('oculto');
}
function fecharModal() { $('#modal').classList.add('oculto'); }

// Debounce: espera o usuário parar de digitar antes de buscar
function atrasar(fn, ms = 350) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- Tabela com busca, filtros e paginação ----------
// cfg = { titulo, url, colunas:[{titulo, render(l), classe}], filtros:[{id, rotulo, tipo, opcoes}], acoes(l), botoes, extraParams }
function listaPaginada(cfg) {
    const conteudo = $('#conteudo');
    const estado = { page: 1, limit: 10 };

    const filtrosHtml = (cfg.filtros || []).map((f) => {
        if (f.tipo === 'select') {
            const ops = (f.opcoes || []).map((o) => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('');
            return `<label>${esc(f.rotulo)}<select data-filtro="${f.id}"><option value="">Todos</option>${ops}</select></label>`;
        }
        if (f.tipo === 'date') return `<label>${esc(f.rotulo)}<input type="date" data-filtro="${f.id}"></label>`;
        return `<label>${esc(f.rotulo || 'Buscar')}<input type="search" placeholder="Digite para buscar..." data-filtro="${f.id}"></label>`;
    }).join('');

    conteudo.innerHTML = `
        <div class="barra">${filtrosHtml}<span class="espaco"></span>${cfg.botoes || ''}</div>
        <div class="cartao">
            <div class="tabela-wrap"><table>
                <thead><tr>${cfg.colunas.map((c) => `<th class="${c.classe || ''}">${esc(c.titulo)}</th>`).join('')}${cfg.acoes ? '<th></th>' : ''}</tr></thead>
                <tbody id="lista-corpo"></tbody>
            </table></div>
            <div class="paginacao" id="lista-pag"></div>
        </div>`;

    async function carregar() {
        const params = { page: estado.page, limit: estado.limit, ...(cfg.extraParams ? cfg.extraParams() : {}) };
        conteudo.querySelectorAll('[data-filtro]').forEach((el) => { params[el.dataset.filtro] = el.value; });
        try {
            const r = await api(cfg.url + qs(params));
            if (cfg.aoCarregar) cfg.aoCarregar(r);
            const corpo = $('#lista-corpo');
            if (!r.dados.length) {
                corpo.innerHTML = `<tr><td class="vazio" colspan="${cfg.colunas.length + 1}">Nenhum registro encontrado.</td></tr>`;
            } else {
                corpo.innerHTML = r.dados.map((l, i) => `<tr>
                    ${cfg.colunas.map((c) => `<td class="${c.classe || ''}">${c.render(l)}</td>`).join('')}
                    ${cfg.acoes ? `<td class="acoes">${cfg.acoes(l)}</td>` : ''}</tr>`).join('');
            }
            $('#lista-pag').innerHTML = `
                <span>${r.total} registro(s) — página ${r.page} de ${r.paginas}</span>
                <div>
                    <select id="pag-limite" style="width:auto">${[10, 25, 50].map((n) => `<option ${n === estado.limit ? 'selected' : ''}>${n}</option>`).join('')}</select>
                    <button class="btn btn-sec btn-sm" id="pag-ant" ${r.page <= 1 ? 'disabled' : ''}>‹ Anterior</button>
                    <button class="btn btn-sec btn-sm" id="pag-prox" ${r.page >= r.paginas ? 'disabled' : ''}>Próxima ›</button>
                </div>`;
            $('#pag-ant').onclick = () => { estado.page--; carregar(); };
            $('#pag-prox').onclick = () => { estado.page++; carregar(); };
            $('#pag-limite').onchange = (e) => { estado.limit = +e.target.value; estado.page = 1; carregar(); };
        } catch (e) { toast(e.message, true); }
    }

    const recarregarBusca = atrasar(() => { estado.page = 1; carregar(); });
    conteudo.querySelectorAll('[data-filtro]').forEach((el) => {
        el.addEventListener(el.type === 'search' ? 'input' : 'change', recarregarBusca);
    });

    carregar();
    return { recarregar: carregar };
}

// ---------- Formulário em modal ----------
// campos = [{ id, rotulo, tipo, opcoes, obrigatorio, inteiro, dica, passo }]
function abrirFormulario({ titulo, campos, valores = {}, aoSalvar, textoSalvar = 'Salvar', aoMudar }) {
    const html = campos.map((c) => {
        const v = valores[c.id] ?? c.padrao ?? '';
        let input;
        if (c.tipo === 'select') {
            input = `<select id="f-${c.id}" ${c.obrigatorio ? 'required' : ''}>
                ${c.vazio === false ? '' : '<option value="">Selecione...</option>'}
                ${(c.opcoes || []).map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(v) ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}
            </select>`;
        } else {
            input = `<input id="f-${c.id}" type="${c.tipo || 'text'}" value="${esc(v)}" ${c.obrigatorio ? 'required' : ''}
                ${c.passo ? `step="${c.passo}"` : ''} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.maxlength ? `maxlength="${c.maxlength}"` : ''}
                ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}>`;
        }
        return `<label class="${c.inteiro ? 'inteiro' : ''}">${esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}${input}</label>`;
    }).join('');

    abrirModal(titulo, `<form id="form-modal"><div class="form-grid">${html}
        <div class="dica inteiro oculto" id="form-dica"></div></div>
        <p class="erro" id="form-erro"></p>
        <div class="form-acoes">
            <button type="button" class="btn btn-sec" id="form-cancelar">Cancelar</button>
            <button type="submit" class="btn">${esc(textoSalvar)}</button>
        </div></form>`);

    const lerValores = () => Object.fromEntries(campos.map((c) => [c.id, $('#f-' + c.id).value]));
    $('#form-cancelar').onclick = fecharModal;
    if (aoMudar) {
        const dica = (txt) => { const d = $('#form-dica'); d.textContent = txt || ''; d.classList.toggle('oculto', !txt); };
        const atualizar = () => aoMudar(lerValores(), dica);
        campos.forEach((c) => $('#f-' + c.id).addEventListener('input', atualizar));
        atualizar();
    }
    $('#form-modal').onsubmit = async (ev) => {
        ev.preventDefault();
        try {
            await aoSalvar(lerValores());
            fecharModal();
        } catch (e) { $('#form-erro').textContent = e.message; }
    };
}

// Confirmação simples
function confirmar(msg) { return window.confirm(msg); }
