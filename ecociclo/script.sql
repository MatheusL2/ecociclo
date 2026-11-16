

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS ecociclo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecociclo;

-- ---------- Coletores ----------
CREATE TABLE IF NOT EXISTS coletores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cpf CHAR(11) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    endereco VARCHAR(200),
    veiculo VARCHAR(60),
    status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Usuários ----------
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    senha_hash VARCHAR(100) NOT NULL,
    perfil ENUM('admin', 'operador', 'coletor') NOT NULL DEFAULT 'operador',
    coletor_id INT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coletor_id) REFERENCES coletores(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Materiais ----------
CREATE TABLE IF NOT EXISTS materiais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(80) NOT NULL UNIQUE,
    categoria VARCHAR(40) NOT NULL,
    unidade_padrao VARCHAR(10) NOT NULL DEFAULT 'kg',
    estoque_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
    estoque_maximo DECIMAL(12,3) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ---------- Preços (histórico por data) ----------
CREATE TABLE IF NOT EXISTS precos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    valor_kg DECIMAL(10,2) NOT NULL,
    data_vigencia DATE NOT NULL,
    FOREIGN KEY (material_id) REFERENCES materiais(id) ON DELETE CASCADE,
    INDEX idx_preco_material_data (material_id, data_vigencia)
) ENGINE=InnoDB;

-- ---------- Estoque ----------
CREATE TABLE IF NOT EXISTS estoque (
    material_id INT PRIMARY KEY,
    quantidade_kg DECIMAL(14,3) NOT NULL DEFAULT 0,
    FOREIGN KEY (material_id) REFERENCES materiais(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Clientes compradores (indústrias) ----------
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    razao_social VARCHAR(150) NOT NULL,
    cnpj CHAR(14) NOT NULL UNIQUE,
    contato VARCHAR(100),
    telefone VARCHAR(20),
    email VARCHAR(120)
) ENGINE=InnoDB;

-- ---------- Entradas (coletas) ----------
CREATE TABLE IF NOT EXISTS entradas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coletor_id INT NOT NULL,
    material_id INT NOT NULL,
    peso_kg DECIMAL(12,3) NOT NULL,
    preco_kg DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pago TINYINT(1) NOT NULL DEFAULT 0,
    data_pagamento DATETIME NULL,
    usuario_id INT NULL,
    FOREIGN KEY (coletor_id) REFERENCES coletores(id),
    FOREIGN KEY (material_id) REFERENCES materiais(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Saídas (vendas) ----------
CREATE TABLE IF NOT EXISTS saidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    material_id INT NOT NULL,
    peso_kg DECIMAL(12,3) NOT NULL,
    valor_kg DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (material_id) REFERENCES materiais(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Dados iniciais ----------
INSERT IGNORE INTO materiais (nome, categoria, unidade_padrao, estoque_minimo, estoque_maximo) VALUES
 ('Papel',     'Papel',   'kg',  200, 5000),
 ('Papelão',   'Papel',   'kg',  300, 8000),
 ('PET',       'Plástico','kg',  150, 4000),
 ('Vidro',     'Vidro',   'kg',  300, 10000),
 ('Alumínio',  'Metal',   'kg',  50,  2000),
 ('Cobre',     'Metal',   'kg',  20,  800),
 ('Ferro',     'Metal',   'kg',  200, 6000);

INSERT IGNORE INTO estoque (material_id, quantidade_kg) SELECT id, 0 FROM materiais;

INSERT INTO precos (material_id, valor_kg, data_vigencia)
SELECT m.id, p.valor, CURDATE()
FROM materiais m
JOIN (
    SELECT 'Papel' AS nome, 0.35 AS valor UNION ALL
    SELECT 'Papelão', 0.45 UNION ALL
    SELECT 'PET', 2.20 UNION ALL
    SELECT 'Vidro', 0.15 UNION ALL
    SELECT 'Alumínio', 6.50 UNION ALL
    SELECT 'Cobre', 28.00 UNION ALL
    SELECT 'Ferro', 0.60
) p ON p.nome = m.nome
WHERE NOT EXISTS (SELECT 1 FROM precos);

