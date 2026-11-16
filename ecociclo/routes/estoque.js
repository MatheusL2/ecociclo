// Consulta de estoque (kg convertido em toneladas, com alerta de estoque baixo/alto)
const express = require('express');
const db = require('../db');
const { erro, arredondar } = require('../utils');

const router = express.Router();

// GET /api/estoque?busca=&status=baixo|normal|alto&page=&limit=
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT m.id AS material_id, m.nome AS material, m.categoria, m.estoque_minimo, m.estoque_maximo,
                    COALESCE(e.quantidade_kg, 0) AS quantidade_kg
             FROM materiais m LEFT JOIN estoque e ON e.material_id = m.id
             ORDER BY m.nome`);

        let lista = rows.map((r) => {
            let status = 'normal';
            if (r.quantidade_kg <= r.estoque_minimo) status = 'baixo';
            else if (r.estoque_maximo > 0 && r.quantidade_kg >= r.estoque_maximo) status = 'alto';
            return { ...r, toneladas: arredondar(r.quantidade_kg / 1000, 3), status };
        });

        const resumo = {
            total_kg: arredondar(lista.reduce((s, r) => s + r.quantidade_kg, 0), 3),
            baixo: lista.filter((r) => r.status === 'baixo').length,
            alto: lista.filter((r) => r.status === 'alto').length
        };
        resumo.total_toneladas = arredondar(resumo.total_kg / 1000, 3);

        if (req.query.busca) {
            const b = req.query.busca.toLowerCase();
            lista = lista.filter((r) => r.material.toLowerCase().includes(b) || r.categoria.toLowerCase().includes(b));
        }
        if (req.query.status) lista = lista.filter((r) => r.status === req.query.status);

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
        res.json({
            dados: lista.slice((page - 1) * limit, page * limit),
            total: lista.length, page, limit, paginas: Math.ceil(lista.length / limit) || 1, resumo
        });
    } catch (e) { erro(res, e); }
});

module.exports = router;
