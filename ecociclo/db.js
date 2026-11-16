// Conexão com o banco de dados MySQL (pacote mysql2)
require('dotenv').config();
const mysql = require('mysql2/promise');

// Usa um "pool" de conexões (várias conexões reaproveitadas)
// e a versão com Promises, para poder usar async/await nas rotas.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',   // endereço do servidor MySQL
    user: process.env.DB_USER || 'root',        // usuário do MySQL
    password: process.env.DB_PASSWORD || '',    // senha do usuário
    database: process.env.DB_NAME || 'ecociclo',// nome do banco de dados
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true, // DECIMAL volta como número (e não como texto)
    dateStrings: true     // datas voltam como texto 'AAAA-MM-DD HH:MM:SS' (evita problemas de fuso)
});

// Exporta o pool para que outros arquivos (rotas) possam usá-lo
module.exports = pool;
