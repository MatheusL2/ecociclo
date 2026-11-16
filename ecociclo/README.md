# ♻ EcoCiclo — Sistema de Gestão de Reciclagem

Aplicação Web (MVP) para cooperativas/empresas de reciclagem controlarem **quem coleta, o que é coletado, quanto vale e quanto há em estoque**.
Projeto da disciplina *Programação para Web* — Node.js + Express + MySQL, com front-end em HTML, CSS e JavaScript.

## Demanda atendida
Cooperativas de reciclagem costumam controlar entregas, pagamentos e estoque em papel ou planilhas, o que gera erros de pesagem, atrasos no pagamento dos catadores e falta de visão do estoque. O EcoCiclo centraliza tudo.

## Funcionalidades
| Módulo | O que faz |
|---|---|
| Coletores | CRUD (nome, CPF, telefone, endereço, veículo, ativo/inativo) + histórico de entregas |
| Materiais | CRUD (categoria, unidade padrão, estoque mínimo/máximo) |
| Preços | Valor por kg com histórico por data e variação em relação ao preço anterior |
| Estoque | Quantidade em kg convertida em toneladas (1 t = 1000 kg) com alerta de estoque baixo/alto |
| Entradas (coletas) | Registra a entrega, calcula `peso × preço vigente`, atualiza o estoque; pagamento e **comprovante** imprimível/PDF |
| Saídas (vendas) | Venda de lotes a indústrias com baixa automática no estoque (bloqueia se faltar estoque) |
| Clientes | CRUD de indústrias compradoras |
| Login e perfis | `admin` (tudo), `operador` (operação diária), `coletor` (vê só as próprias entregas) |
| Relatórios | Por período, material, coletor ou cliente — tela, **Excel (CSV)** e **PDF** (imprimir) |
| Todas as listas | Busca, filtros e paginação |

Entradas e saídas usam **transações** no banco: se algo falha, o estoque não fica inconsistente.

## Estrutura
```
ecociclo/
├── server.js          # servidor Express (middlewares + rotas)
├── db.js              # conexão MySQL (mysql2)
├── utils.js           # paginação, erros, CSV
├── script.sql         # criação do banco/tabelas + dados iniciais
├── middlewares/auth.js# JWT e perfis
├── routes/            # uma rota por módulo (express.Router)
└── public/            # front-end (index.html, css/, js/)
```

## Como executar
1. Instale o [Node.js](https://nodejs.org) e o MySQL.
2. Crie o banco: `mysql -u root -p < script.sql`
3. Copie `.env.example` para `.env` e ajuste a senha do MySQL.
4. `npm install`
5. `npm start` e abra **http://localhost:3000**

Login inicial: **admin@ecociclo.com / admin123** (criado automaticamente).

## API (resumo)
Todas as rotas abaixo de `/api` (exceto `/auth/login`) exigem `Authorization: Bearer <token>`.

`/auth/login` · `/coletores` · `/materiais` · `/precos` · `/estoque` · `/entradas` · `/saidas` · `/clientes` · `/usuarios` · `/relatorios/:tipo` · `/dashboard`

Listas aceitam `?busca=&page=&limit=` e filtros específicos (`material_id`, `inicio`, `fim`...).
