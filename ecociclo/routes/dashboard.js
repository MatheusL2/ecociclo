// Números resumidos para a tela inicial
const express = require('express');
const db = require('../db');
const { erro } = require('../utils');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [[c]] = await db.query("SELECT COUNT(*) AS total FROM coletores WHERE status = 'ativo'");
        const [[e]] = await db.query(
            `SELECT COALESCE(SUM(peso_kg),0) AS kg, COALESCE(SUM(valor_total),0) AS valor
             FROM entradas WHERE YEAR(data_hora) = YEAR(CURDATE()) AND MONTH(data_hora) = MONTH(CURDATE())`);
        const [[s]] = await db.query(
            `SELECT COALESCE(SUM(valor_total),0) AS valor
             FROM saidas WHERE YEAR(data_hora) = YEAR(CURDATE()) AND MONTH(data_hora) = MONTH(CURDATE())`);
        const [[p]] = await db.query('SELECT COALESCE(SUM(valor_total),0) AS valor FROM entradas WHERE pago = 0');
        const [[est]] = await db.query('SELECT COALESCE(SUM(quantidade_kg),0) AS kg FROM estoque');
        const [porMaterial] = await db.query(
            `SELECT m.nome AS material, COALESCE(e.quantidade_kg,0) AS quantidade_kg
             FROM materiais m LEFT JOIN estoque e ON e.material_id = m.id ORDER BY quantidade_kg DESC`);
        res.json({
            coletores_ativos: c.total,
            entradas_mes_kg: e.kg, entradas_mes_valor: e.valor,
            vendas_mes_valor: s.valor, a_pagar_coletores: p.valor,
            estoque_total_kg: est.kg, estoque_total_toneladas: Math.round(est.kg) / 1000,
            por_material: porMaterial
        });
    } catch (err) { erro(res, err); }
});

module.exports = router;
