// Cada página do sistema. Todas recebem o usuário logado e desenham dentro de #conteudo.

let opcoesCache = null;
async function opcoes(forcar = false) {
    if (!opcoesCache || forcar) opcoesCache = await api('/opcoes');
    return opcoesCache;
}
const comoOpcoes = (lista, campo = 'nome') => lista.map((i) => ({ valor: i.id, texto: i[campo] }));
const hoje = () => new Date().toISOString().slice(0, 10);
const agoraLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const ehAdmin = (u) => u.perfil === 'admin';

// ---------- CRUD genérico (listar, criar, editar, excluir) ----------
function paginaCrud({ rota, nome, artigo = 'o', campos, colunas, filtros, extrasAcoes, extrasBotoes, antesDeSalvar, camposDinamicos }) {
    return async (usuario) => {
        const ctl = listaPaginada({
            url: rota,
            filtros: typeof filtros === 'function' ? await filtros() : filtros,
            colunas,
            botoes: `<button class="btn" id="btn-novo">+ Novo(a) ${esc(nome)}</button>${extrasBotoes || ''}`,
            acoes: (l) => `${extrasAcoes ? extrasAcoes(l) : ''}
                <button class="btn btn-sec btn-sm" data-editar="${l.id}">Editar</button>
                ${ehAdmin(usuario) ? `<button class="btn btn-perigo btn-sm" data-excluir="${l.id}">Excluir</button>` : ''}`
        });

        const salvar = (id) => async (v) => {
            const corpo = antesDeSalvar ? antesDeSalvar(v) : v;
            const r = await api(id ? `${rota}/${id}` : rota, { method: id ? 'PUT' : 'POST', body: corpo });
            toast(r.mensagem);
            await opcoes(true);
            ctl.recarregar();
        };

        const camposAtuais = async () => (camposDinamicos ? camposDinamicos() : campos);

        $('#btn-novo').onclick = async () =>
            abrirFormulario({ titulo: `Novo(a) ${nome}`, campos: await camposAtuais(), aoSalvar: salvar(null) });

        // Delegação de eventos: um único "ouvinte" para todos os botões da tabela
        $('#conteudo').onclick = async (ev) => {
            const b = ev.target.closest('button');
            if (!b) return;
            if (b.dataset.editar) {
                const id = b.dataset.editar;
                const l = (await api(`${rota}${qs({ limit: 100 })}`)).dados.find((x) => String(x.id) === id);
                abrirFormulario({ titulo: `Editar ${nome}`, campos: await camposAtuais(), valores: l, aoSalvar: salvar(id) });
            }
            if (b.dataset.excluir && confirmar(`Excluir ${artigo} ${nome.toLowerCase()} selecionad${artigo}?`)) {
                try {
                    const r = await api(`${rota}/${b.dataset.excluir}`, { method: 'DELETE' });
                    toast(r.mensagem);
                    ctl.recarregar();
                } catch (e) { toast(e.message, true); }
            }
            if (b.dataset.extra && extrasAcoes) await PAGINAS_EXTRA[b.dataset.extra]?.(b.dataset.id, ctl);
        };
    };
}
const PAGINAS_EXTRA = {};

// ======================================================================
const PAGINAS = {};

// ---------- Dashboard ----------
PAGINAS.dashboard = async () => {
    const d = await api('/dashboard');
    const max = Math.max(...d.por_material.map((m) => m.quantidade_kg), 1);
    $('#conteudo').innerHTML = `
        <div class="cards">
            <div class="card-num"><small>Coletores ativos</small><strong>${d.coletores_ativos}</strong></div>
            <div class="card-num"><small>Coletado no mês</small><strong>${fmt.kg(d.entradas_mes_kg)}</strong></div>
            <div class="card-num"><small>Pago/devido em coletas (mês)</small><strong>${fmt.moeda(d.entradas_mes_valor)}</strong></div>
            <div class="card-num"><small>Vendas no mês</small><strong>${fmt.moeda(d.vendas_mes_valor)}</strong></div>
            <div class="card-num"><small>A pagar aos coletores</small><strong>${fmt.moeda(d.a_pagar_coletores)}</strong></div>
            <div class="card-num"><small>Estoque total</small><strong>${fmt.num(d.estoque_total_toneladas)} t</strong></div>
        </div>
        <div class="cartao"><div class="barras"><strong>Estoque por material</strong>
            ${d.por_material.map((m) => `<div class="barra-linha"><span>${esc(m.material)}</span>
                <div class="barra-fundo"><div class="barra-preench" style="width:${(m.quantidade_kg / max) * 100}%"></div></div>
                <span>${fmt.kg(m.quantidade_kg)}</span></div>`).join('')}
        </div></div>`;
};

// ---------- Coletores ----------
const CAMPOS_COLETOR = [
    { id: 'nome', rotulo: 'Nome', obrigatorio: true, inteiro: true },
    { id: 'cpf', rotulo: 'CPF (somente números)', obrigatorio: true, maxlength: 14 },
    { id: 'telefone', rotulo: 'Telefone' },
    { id: 'endereco', rotulo: 'Endereço', inteiro: true },
    { id: 'veiculo', rotulo: 'Veículo (ex.: carrinho, moto, caminhão)' },
    { id: 'status', rotulo: 'Status', tipo: 'select', vazio: false, padrao: 'ativo',
      opcoes: [{ valor: 'ativo', texto: 'Ativo' }, { valor: 'inativo', texto: 'Inativo' }] }
];
PAGINAS.coletores = paginaCrud({
    rota: '/coletores', nome: 'Coletor', campos: CAMPOS_COLETOR,
    filtros: [
        { id: 'busca', rotulo: 'Buscar (nome, CPF, telefone)' },
        { id: 'status', rotulo: 'Status', tipo: 'select', opcoes: [{ valor: 'ativo', texto: 'Ativo' }, { valor: 'inativo', texto: 'Inativo' }] }
    ],
    colunas: [
        { titulo: 'Nome', render: (l) => esc(l.nome) },
        { titulo: 'CPF', render: (l) => fmt.cpf(l.cpf) },
        { titulo: 'Telefone', render: (l) => esc(l.telefone) },
        { titulo: 'Veículo', render: (l) => esc(l.veiculo) },
        { titulo: 'Status', render: (l) => `<span class="selo ${l.status === 'ativo' ? 'ok' : 'off'}">${l.status}</span>` }
    ],
    extrasAcoes: (l) => `<button class="btn btn-sec btn-sm" data-extra="historico" data-id="${l.id}">Histórico</button>`
});
PAGINAS_EXTRA.historico = async (id) => {
    const { coletor, entregas, totais } = await api('/coletores/' + id);
    abrirModal(`Histórico — ${coletor.nome}`, `
        <div class="cards">
            <div class="card-num"><small>Entregas</small><strong>${totais.entregas}</strong></div>
            <div class="card-num"><small>Total entregue</small><strong>${fmt.kg(totais.peso_kg)}</strong></div>
            <div class="card-num"><small>A receber</small><strong>${fmt.moeda(totais.a_pagar)}</strong></div>
        </div>
        <div class="cartao"><div class="tabela-wrap"><table>
            <thead><tr><th>Data</th><th>Material</th><th class="num">Peso</th><th class="num">Valor</th><th>Pago</th></tr></thead>
            <tbody>${entregas.length ? entregas.map((e) => `<tr><td>${fmt.data(e.data_hora)}</td><td>${esc(e.material)}</td>
                <td class="num">${fmt.kg(e.peso_kg)}</td><td class="num">${fmt.moeda(e.valor_total)}</td>
                <td><span class="selo ${e.pago ? 'ok' : 'alto'}">${e.pago ? 'Pago' : 'Pendente'}</span></td></tr>`).join('')
                : '<tr><td class="vazio" colspan="5">Nenhuma entrega registrada.</td></tr>'}</tbody>
        </table></div></div>
        <div class="form-acoes"><button class="btn btn-sec" onclick="fecharModal()">Fechar</button></div>`);
};

// ---------- Materiais ----------
PAGINAS.materiais = paginaCrud({
    rota: '/materiais', nome: 'Material',
    campos: [
        { id: 'nome', rotulo: 'Nome', obrigatorio: true },
        { id: 'categoria', rotulo: 'Categoria (Papel, Plástico, Metal...)', obrigatorio: true },
        { id: 'unidade_padrao', rotulo: 'Unidade padrão', padrao: 'kg' },
        { id: 'estoque_minimo', rotulo: 'Estoque mínimo (kg) — alerta baixo', tipo: 'number', passo: '0.001', min: 0, padrao: 0 },
        { id: 'estoque_maximo', rotulo: 'Estoque máximo (kg) — alerta alto', tipo: 'number', passo: '0.001', min: 0, padrao: 0 }
    ],
    filtros: [{ id: 'busca', rotulo: 'Buscar material' }],
    colunas: [
        { titulo: 'Material', render: (l) => esc(l.nome) },
        { titulo: 'Categoria', render: (l) => esc(l.categoria) },
        { titulo: 'Unidade', render: (l) => esc(l.unidade_padrao) },
        { titulo: 'Mínimo', classe: 'num', render: (l) => fmt.kg(l.estoque_minimo) },
        { titulo: 'Máximo', classe: 'num', render: (l) => fmt.kg(l.estoque_maximo) }
    ]
});

// ---------- Preços ----------
PAGINAS.precos = async (usuario) => {
    const op = await opcoes(true);
    const atuais = await api('/precos/atual');
    const ctl = listaPaginada({
        url: '/precos',
        filtros: [{ id: 'material_id', rotulo: 'Material', tipo: 'select', opcoes: comoOpcoes(op.materiais) }],
        botoes: '<button class="btn" id="btn-novo">+ Novo preço</button>',
        colunas: [
            { titulo: 'Data de vigência', render: (l) => fmt.data(l.data_vigencia) },
            { titulo: 'Material', render: (l) => esc(l.material) },
            { titulo: 'Valor por kg', classe: 'num', render: (l) => fmt.moeda(l.valor_kg) },
            { titulo: 'Variação', classe: 'num', render: (l) => l.variacao === null ? '—'
                : `<span style="color:${l.variacao >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${l.variacao >= 0 ? '▲' : '▼'} ${fmt.moeda(Math.abs(l.variacao))}</span>` }
        ],
        acoes: ehAdmin(usuario) ? (l) => `<button class="btn btn-perigo btn-sm" data-excluir="${l.id}">Excluir</button>` : null
    });
    // Preços vigentes (resumo acima do histórico)
    $('#conteudo').insertAdjacentHTML('afterbegin', `<div class="cards">${atuais.map((p) =>
        `<div class="card-num"><small>${esc(p.material)}</small><strong>${p.valor_kg === null ? '—' : fmt.moeda(p.valor_kg) + '/kg'}</strong></div>`).join('')}</div>`);

    $('#btn-novo').onclick = () => abrirFormulario({
        titulo: 'Novo preço por kg',
        campos: [
            { id: 'material_id', rotulo: 'Material', tipo: 'select', obrigatorio: true, opcoes: comoOpcoes(op.materiais), inteiro: true },
            { id: 'valor_kg', rotulo: 'Valor por kg (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrigatorio: true },
            { id: 'data_vigencia', rotulo: 'Vigente a partir de', tipo: 'date', padrao: hoje(), obrigatorio: true }
        ],
        aoSalvar: async (v) => { toast((await api('/precos', { method: 'POST', body: v })).mensagem); PAGINAS.precos(usuario); }
    });
    $('#conteudo').onclick = async (ev) => {
        const b = ev.target.closest('[data-excluir]');
        if (b && confirmar('Excluir este registro de preço?')) {
            try { toast((await api('/precos/' + b.dataset.excluir, { method: 'DELETE' })).mensagem); PAGINAS.precos(usuario); }
            catch (e) { toast(e.message, true); }
        }
    };
};

// ---------- Estoque ----------
PAGINAS.estoque = async () => {
    let resumo;
    listaPaginada({
        url: '/estoque',
        filtros: [
            { id: 'busca', rotulo: 'Buscar material/categoria' },
            { id: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [
                { valor: 'baixo', texto: 'Estoque baixo' }, { valor: 'normal', texto: 'Normal' }, { valor: 'alto', texto: 'Estoque alto' }] }
        ],
        aoCarregar: (r) => {
            resumo = r.resumo;
            let el = $('#resumo-estoque');
            if (!el) { $('#conteudo').insertAdjacentHTML('afterbegin', '<div class="cards" id="resumo-estoque"></div>'); el = $('#resumo-estoque'); }
            el.innerHTML = `
                <div class="card-num"><small>Total em estoque</small><strong>${fmt.num(resumo.total_toneladas)} t</strong><small>${fmt.kg(resumo.total_kg)}</small></div>
                <div class="card-num"><small>Materiais com estoque baixo</small><strong style="color:var(--vermelho)">${resumo.baixo}</strong></div>
                <div class="card-num"><small>Materiais com estoque alto</small><strong style="color:var(--amarelo)">${resumo.alto}</strong></div>`;
        },
        colunas: [
            { titulo: 'Material', render: (l) => esc(l.material) },
            { titulo: 'Categoria', render: (l) => esc(l.categoria) },
            { titulo: 'Quantidade (kg)', classe: 'num', render: (l) => fmt.kg(l.quantidade_kg) },
            { titulo: 'Toneladas', classe: 'num', render: (l) => fmt.num(l.toneladas) + ' t' },
            { titulo: 'Situação', render: (l) => ({
                baixo: '<span class="selo baixo">▼ Estoque baixo</span>',
                alto: '<span class="selo alto">▲ Estoque alto</span>',
                normal: '<span class="selo ok">Normal</span>' }[l.status]) }
        ]
    });
};

// ---------- Entradas (coletas) ----------
PAGINAS.entradas = async (usuario) => {
    const op = await opcoes(true);
    const podeEditar = usuario.perfil !== 'coletor';
    const ctl = listaPaginada({
        url: '/entradas',
        filtros: [
            { id: 'busca', rotulo: 'Buscar' },
            ...(podeEditar ? [{ id: 'coletor_id', rotulo: 'Coletor', tipo: 'select', opcoes: comoOpcoes(op.coletores) }] : []),
            { id: 'material_id', rotulo: 'Material', tipo: 'select', opcoes: comoOpcoes(op.materiais) },
            { id: 'inicio', rotulo: 'De', tipo: 'date' }, { id: 'fim', rotulo: 'Até', tipo: 'date' },
            { id: 'pago', rotulo: 'Pagamento', tipo: 'select', opcoes: [{ valor: '0', texto: 'Pendente' }, { valor: '1', texto: 'Pago' }] }
        ],
        botoes: podeEditar ? '<button class="btn" id="btn-novo">+ Nova coleta</button>' : '',
        colunas: [
            { titulo: 'Nº', render: (l) => l.id },
            { titulo: 'Data', render: (l) => fmt.data(l.data_hora) },
            { titulo: 'Coletor', render: (l) => esc(l.coletor) },
            { titulo: 'Material', render: (l) => esc(l.material) },
            { titulo: 'Peso', classe: 'num', render: (l) => fmt.kg(l.peso_kg) },
            { titulo: 'Preço/kg', classe: 'num', render: (l) => fmt.moeda(l.preco_kg) },
            { titulo: 'Valor', classe: 'num', render: (l) => fmt.moeda(l.valor_total) },
            { titulo: 'Pagamento', render: (l) => `<span class="selo ${l.pago ? 'ok' : 'alto'}">${l.pago ? 'Pago' : 'Pendente'}</span>` }
        ],
        acoes: (l) => `<button class="btn btn-sec btn-sm" data-comp="${l.id}">Comprovante</button>` + (podeEditar ? `
            ${l.pago ? '' : `<button class="btn btn-sm" data-pagar="${l.id}">Pagar</button>
            <button class="btn btn-sec btn-sm" data-editar="${l.id}">Editar</button>`}
            ${ehAdmin(usuario) && !l.pago ? `<button class="btn btn-perigo btn-sm" data-excluir="${l.id}">Excluir</button>` : ''}` : '')
    });

    // Mostra, enquanto o operador digita, o valor que será pago
    // O perfil coletor não acessa /precos (e não registra coletas), então só busca os preços quem pode editar
    const precosAtuais = podeEditar
        ? Object.fromEntries((await api('/precos/atual')).map((p) => [p.material_id, p.valor_kg]))
        : {};
    const camposEntrada = [
        { id: 'coletor_id', rotulo: 'Coletor', tipo: 'select', obrigatorio: true, inteiro: true,
          opcoes: comoOpcoes(op.coletores.filter((c) => c.status !== 'inativo')) },
        { id: 'material_id', rotulo: 'Material', tipo: 'select', obrigatorio: true, opcoes: comoOpcoes(op.materiais) },
        { id: 'peso_kg', rotulo: 'Peso pesado (kg)', tipo: 'number', passo: '0.001', min: 0.001, obrigatorio: true },
        { id: 'data_hora', rotulo: 'Data e hora', tipo: 'datetime-local', padrao: agoraLocal(), inteiro: true }
    ];
    const aoMudar = (v, dica) => {
        const p = precosAtuais[v.material_id], kg = Number(v.peso_kg);
        dica(p && kg > 0 ? `${fmt.kg(kg)} × ${fmt.moeda(p)}/kg = ${fmt.moeda(kg * p)}` : (v.material_id && !p ? 'Este material ainda não tem preço cadastrado.' : ''));
    };
    const salvar = (id) => async (v) => {
        const r = await api(id ? '/entradas/' + id : '/entradas', { method: id ? 'PUT' : 'POST', body: v });
        toast(r.mensagem); ctl.recarregar();
    };

    if (podeEditar) $('#btn-novo').onclick = () => abrirFormulario({ titulo: 'Registrar coleta', campos: camposEntrada, aoSalvar: salvar(null), aoMudar });

    $('#conteudo').onclick = async (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        try {
            if (b.dataset.editar) {
                const l = (await api('/entradas' + qs({ limit: 100 }))).dados.find((x) => String(x.id) === b.dataset.editar);
                abrirFormulario({ titulo: 'Editar coleta', campos: camposEntrada, aoMudar, aoSalvar: salvar(l.id),
                    valores: { ...l, data_hora: String(l.data_hora).slice(0, 16).replace(' ', 'T') } });
            }
            if (b.dataset.pagar && confirmar('Confirmar o pagamento ao coletor?')) {
                toast((await api(`/entradas/${b.dataset.pagar}/pagar`, { method: 'PUT' })).mensagem); ctl.recarregar();
            }
            if (b.dataset.excluir && confirmar('Excluir esta coleta? O estoque será ajustado.')) {
                toast((await api('/entradas/' + b.dataset.excluir, { method: 'DELETE' })).mensagem); ctl.recarregar();
            }
            if (b.dataset.comp) comprovante(await api(`/entradas/${b.dataset.comp}/comprovante`));
        } catch (e) { toast(e.message, true); }
    };
};

function comprovante(e) {
    abrirModal('Comprovante de entrega', `
        <div class="comprovante imprimivel">
            <h4>♻ EcoCiclo<br>COMPROVANTE DE ENTREGA Nº ${String(e.id).padStart(6, '0')}</h4>
            <div class="linha"><span>Data</span><span>${fmt.data(e.data_hora)}</span></div>
            <div class="linha"><span>Coletor</span><span>${esc(e.coletor)}</span></div>
            <div class="linha"><span>CPF</span><span>${fmt.cpf(e.cpf)}</span></div>
            <div class="linha"><span>Material</span><span>${esc(e.material)}</span></div>
            <div class="linha"><span>Peso</span><span>${fmt.kg(e.peso_kg)}</span></div>
            <div class="linha"><span>Preço por kg</span><span>${fmt.moeda(e.preco_kg)}</span></div>
            <div class="linha"><strong>TOTAL</strong><strong>${fmt.moeda(e.valor_total)}</strong></div>
            <div class="linha"><span>Situação</span><span>${e.pago ? 'PAGO em ' + fmt.data(e.data_pagamento) : 'PENDENTE'}</span></div>
            <div class="linha"><span>Operador</span><span>${esc(e.operador || '—')}</span></div>
            <br><br><div style="text-align:center">_______________________________<br>Assinatura do coletor</div>
        </div>
        <div class="form-acoes no-print">
            <button class="btn btn-sec" onclick="fecharModal()">Fechar</button>
            <button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button>
        </div>`);
}

// ---------- Clientes (indústrias compradoras) ----------
PAGINAS.clientes = paginaCrud({
    rota: '/clientes', nome: 'Cliente',
    campos: [
        { id: 'razao_social', rotulo: 'Razão social', obrigatorio: true, inteiro: true },
        { id: 'cnpj', rotulo: 'CNPJ (somente números)', obrigatorio: true, maxlength: 18 },
        { id: 'contato', rotulo: 'Pessoa de contato' },
        { id: 'telefone', rotulo: 'Telefone' },
        { id: 'email', rotulo: 'E-mail', tipo: 'email' }
    ],
    filtros: [{ id: 'busca', rotulo: 'Buscar (razão social, CNPJ, contato)' }],
    colunas: [
        { titulo: 'Razão social', render: (l) => esc(l.razao_social) },
        { titulo: 'CNPJ', render: (l) => fmt.cnpj(l.cnpj) },
        { titulo: 'Contato', render: (l) => esc(l.contato) },
        { titulo: 'Telefone', render: (l) => esc(l.telefone) },
        { titulo: 'E-mail', render: (l) => esc(l.email) }
    ]
});

// ---------- Saídas (vendas) ----------
PAGINAS.saidas = async (usuario) => {
    const op = await opcoes(true);
    const ctl = listaPaginada({
        url: '/saidas',
        filtros: [
            { id: 'busca', rotulo: 'Buscar' },
            { id: 'cliente_id', rotulo: 'Cliente', tipo: 'select', opcoes: comoOpcoes(op.clientes) },
            { id: 'material_id', rotulo: 'Material', tipo: 'select', opcoes: comoOpcoes(op.materiais) },
            { id: 'inicio', rotulo: 'De', tipo: 'date' }, { id: 'fim', rotulo: 'Até', tipo: 'date' }
        ],
        botoes: '<button class="btn" id="btn-novo">+ Nova venda</button>',
        colunas: [
            { titulo: 'Nº', render: (l) => l.id },
            { titulo: 'Data', render: (l) => fmt.data(l.data_hora) },
            { titulo: 'Cliente', render: (l) => esc(l.cliente) },
            { titulo: 'Material', render: (l) => esc(l.material) },
            { titulo: 'Peso', classe: 'num', render: (l) => fmt.kg(l.peso_kg) },
            { titulo: 'Valor/kg', classe: 'num', render: (l) => fmt.moeda(l.valor_kg) },
            { titulo: 'Total', classe: 'num', render: (l) => fmt.moeda(l.valor_total) }
        ],
        acoes: (l) => `<button class="btn btn-sec btn-sm" data-editar="${l.id}">Editar</button>
            ${ehAdmin(usuario) ? `<button class="btn btn-perigo btn-sm" data-excluir="${l.id}">Excluir</button>` : ''}`
    });
    const campos = [
        { id: 'cliente_id', rotulo: 'Cliente', tipo: 'select', obrigatorio: true, inteiro: true, opcoes: comoOpcoes(op.clientes) },
        { id: 'material_id', rotulo: 'Material', tipo: 'select', obrigatorio: true, opcoes: comoOpcoes(op.materiais) },
        { id: 'peso_kg', rotulo: 'Peso vendido (kg)', tipo: 'number', passo: '0.001', min: 0.001, obrigatorio: true },
        { id: 'valor_kg', rotulo: 'Valor de venda por kg (R$)', tipo: 'number', passo: '0.01', min: 0.01, obrigatorio: true },
        { id: 'data_hora', rotulo: 'Data e hora', tipo: 'datetime-local', padrao: agoraLocal() }
    ];
    const aoMudar = (v, dica) => {
        const kg = Number(v.peso_kg), p = Number(v.valor_kg);
        dica(kg > 0 && p > 0 ? `Total da venda: ${fmt.moeda(kg * p)}` : '');
    };
    const salvar = (id) => async (v) => {
        toast((await api(id ? '/saidas/' + id : '/saidas', { method: id ? 'PUT' : 'POST', body: v })).mensagem);
        ctl.recarregar();
    };
    $('#btn-novo').onclick = () => abrirFormulario({ titulo: 'Registrar venda', campos, aoSalvar: salvar(null), aoMudar });
    $('#conteudo').onclick = async (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        try {
            if (b.dataset.editar) {
                const l = (await api('/saidas' + qs({ limit: 100 }))).dados.find((x) => String(x.id) === b.dataset.editar);
                abrirFormulario({ titulo: 'Editar venda', campos, aoMudar, aoSalvar: salvar(l.id),
                    valores: { ...l, data_hora: String(l.data_hora).slice(0, 16).replace(' ', 'T') } });
            }
            if (b.dataset.excluir && confirmar('Excluir esta venda? O estoque será estornado.')) {
                toast((await api('/saidas/' + b.dataset.excluir, { method: 'DELETE' })).mensagem); ctl.recarregar();
            }
        } catch (e) { toast(e.message, true); }
    };
};

// ---------- Usuários ----------
PAGINAS.usuarios = paginaCrud({
    rota: '/usuarios', nome: 'Usuário',
    camposDinamicos: async () => {
        const op = await opcoes(true);
        return [
            { id: 'nome', rotulo: 'Nome', obrigatorio: true, inteiro: true },
            { id: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true },
            { id: 'senha', rotulo: 'Senha (deixe vazio para manter)', tipo: 'password' },
            { id: 'perfil', rotulo: 'Perfil', tipo: 'select', vazio: false, padrao: 'operador', opcoes: [
                { valor: 'admin', texto: 'Administrador' }, { valor: 'operador', texto: 'Operador' }, { valor: 'coletor', texto: 'Coletor' }] },
            { id: 'coletor_id', rotulo: 'Coletor vinculado (se perfil coletor)', tipo: 'select', opcoes: comoOpcoes(op.coletores) },
            { id: 'ativo', rotulo: 'Situação', tipo: 'select', vazio: false, padrao: 1, opcoes: [{ valor: 1, texto: 'Ativo' }, { valor: 0, texto: 'Inativo' }] }
        ];
    },
    filtros: [
        { id: 'busca', rotulo: 'Buscar (nome, e-mail)' },
        { id: 'perfil', rotulo: 'Perfil', tipo: 'select', opcoes: [{ valor: 'admin', texto: 'Administrador' }, { valor: 'operador', texto: 'Operador' }, { valor: 'coletor', texto: 'Coletor' }] }
    ],
    colunas: [
        { titulo: 'Nome', render: (l) => esc(l.nome) },
        { titulo: 'E-mail', render: (l) => esc(l.email) },
        { titulo: 'Perfil', render: (l) => esc(l.perfil) },
        { titulo: 'Situação', render: (l) => `<span class="selo ${l.ativo ? 'ok' : 'off'}">${l.ativo ? 'Ativo' : 'Inativo'}</span>` }
    ]
});

// ---------- Relatórios ----------
PAGINAS.relatorios = async () => {
    const op = await opcoes(true);
    $('#conteudo').innerHTML = `
        <div class="barra no-print">
            <label>Relatório<select id="r-tipo">
                <option value="entradas">Entradas (coletas)</option><option value="saidas">Saídas (vendas)</option><option value="estoque">Estoque</option></select></label>
            <label>De<input type="date" id="r-inicio"></label>
            <label>Até<input type="date" id="r-fim"></label>
            <label>Material<select id="r-material"><option value="">Todos</option>${comoOpcoes(op.materiais).map((o) => `<option value="${o.valor}">${esc(o.texto)}</option>`).join('')}</select></label>
            <label id="r-l-coletor">Coletor<select id="r-coletor"><option value="">Todos</option>${comoOpcoes(op.coletores).map((o) => `<option value="${o.valor}">${esc(o.texto)}</option>`).join('')}</select></label>
            <label id="r-l-cliente">Cliente<select id="r-cliente"><option value="">Todos</option>${comoOpcoes(op.clientes).map((o) => `<option value="${o.valor}">${esc(o.texto)}</option>`).join('')}</select></label>
            <button class="btn" id="r-gerar">Gerar</button>
            <button class="btn btn-sec" id="r-csv">Excel (CSV)</button>
            <button class="btn btn-sec" id="r-pdf">PDF / Imprimir</button>
        </div>
        <div id="r-resultado" class="cartao imprimivel"></div>`;

    const params = () => ({
        inicio: $('#r-inicio').value, fim: $('#r-fim').value, material_id: $('#r-material').value,
        coletor_id: $('#r-tipo').value === 'entradas' ? $('#r-coletor').value : '',
        cliente_id: $('#r-tipo').value === 'saidas' ? $('#r-cliente').value : ''
    });
    const ajustarFiltros = () => {
        const t = $('#r-tipo').value;
        $('#r-l-coletor').classList.toggle('oculto', t !== 'entradas');
        $('#r-l-cliente').classList.toggle('oculto', t !== 'saidas');
        $('#r-inicio').parentElement.classList.toggle('oculto', t === 'estoque');
        $('#r-fim').parentElement.classList.toggle('oculto', t === 'estoque');
    };
    const ehNumero = (campo) => /peso|preco|valor|quantidade|toneladas/.test(campo);
    const formatar = (campo, v) =>
        /preco|valor/.test(campo) ? fmt.moeda(v) : /peso|quantidade/.test(campo) ? fmt.num(v) : /toneladas/.test(campo) ? fmt.num(v) : esc(v);

    async function gerar() {
        try {
            const r = await api(`/relatorios/${$('#r-tipo').value}` + qs(params()));
            $('#r-resultado').innerHTML = `
                <div style="padding:14px 16px"><strong>${esc(r.titulo)}</strong>
                    <div style="color:var(--suave);font-size:.85rem">Emitido em ${new Date().toLocaleString('pt-BR')}
                    ${$('#r-inicio').value ? ' — período: ' + fmt.data($('#r-inicio').value) + ' a ' + (fmt.data($('#r-fim').value) || 'hoje') : ''}</div></div>
                <div class="tabela-wrap"><table>
                    <thead><tr>${r.colunas.map((c) => `<th class="${ehNumero(c.campo) ? 'num' : ''}">${esc(c.titulo)}</th>`).join('')}</tr></thead>
                    <tbody>${r.linhas.length ? r.linhas.map((l) => `<tr>${r.colunas.map((c) =>
                        `<td class="${ehNumero(c.campo) ? 'num' : ''}">${formatar(c.campo, l[c.campo])}</td>`).join('')}</tr>`).join('')
                        : `<tr><td class="vazio" colspan="${r.colunas.length}">Nenhum dado no período.</td></tr>`}
                    <tr style="font-weight:700;background:var(--verde-claro)">${r.colunas.map((c, i) =>
                        `<td class="${ehNumero(c.campo) ? 'num' : ''}">${r.totais[c.campo] !== undefined ? formatar(c.campo, r.totais[c.campo]) : (i === 0 ? 'TOTAL' : '')}</td>`).join('')}</tr>
                    </tbody></table></div>`;
        } catch (e) { toast(e.message, true); }
    }

    $('#r-tipo').onchange = () => { ajustarFiltros(); gerar(); };
    $('#r-gerar').onclick = gerar;
    $('#r-pdf').onclick = () => window.print();
    $('#r-csv').onclick = () => baixar(`/relatorios/${$('#r-tipo').value}` + qs({ ...params(), formato: 'csv' }), `${$('#r-tipo').value}.csv`).catch((e) => toast(e.message, true));
    ajustarFiltros();
    gerar();
};
