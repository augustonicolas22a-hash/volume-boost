-- =====================================================
-- ATUALIZAÇÃO DO BANCO MySQL - Data Sistemas
-- Execute este script no seu banco existente
-- =====================================================

-- Adicionar colunas faltantes na tabela admins
ALTER TABLE `admins` 
  ADD COLUMN IF NOT EXISTS `pin` VARCHAR(255) DEFAULT NULL AFTER `rank`,
  ADD COLUMN IF NOT EXISTS `criado_por` INT(11) DEFAULT NULL AFTER `id`;

-- Criar índice para criado_por (hierarquia master/revendedor)
ALTER TABLE `admins` ADD INDEX IF NOT EXISTS `idx_admins_criado_por` (`criado_por`);

-- =====================================================
-- Tabela: credit_transactions (transações de crédito)
-- =====================================================
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `from_admin_id` INT(11) DEFAULT NULL,
  `to_admin_id` INT(11) NOT NULL,
  `amount` INT(11) NOT NULL,
  `unit_price` DECIMAL(10,2) DEFAULT NULL,
  `total_price` DECIMAL(10,2) DEFAULT NULL,
  `transaction_type` VARCHAR(20) NOT NULL COMMENT 'recharge ou transfer',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_from_admin` (`from_admin_id`),
  KEY `idx_to_admin` (`to_admin_id`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Tabela: monthly_goals (metas mensais)
-- =====================================================
CREATE TABLE IF NOT EXISTS `monthly_goals` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `year` INT(11) NOT NULL,
  `month` INT(11) NOT NULL,
  `target_revenue` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_year_month` (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Tabela: price_tiers (faixas de preço)
-- =====================================================
CREATE TABLE IF NOT EXISTS `price_tiers` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `min_qty` INT(11) NOT NULL,
  `max_qty` INT(11) DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir faixas de preço padrão (se não existirem)
INSERT IGNORE INTO `price_tiers` (`id`, `min_qty`, `max_qty`, `price`, `is_active`) VALUES
(1, 50, 50, 1.40, 1),
(2, 100, 100, 1.30, 1),
(3, 200, 200, 1.20, 1),
(4, 300, 300, 1.10, 1),
(5, 500, 500, 1.00, 1);

-- =====================================================
-- Verificar e criar admin padrão (dono) se não existir
-- =====================================================
INSERT INTO `admins` (`nome`, `email`, `key`, `creditos`, `rank`, `criado_por`)
SELECT 'Administrador', 'admin@admin.com', 'admin123', 999999, 'dono', NULL
WHERE NOT EXISTS (SELECT 1 FROM `admins` WHERE `rank` = 'dono');

-- =====================================================
-- PRONTO! Banco atualizado com sucesso.
-- =====================================================
