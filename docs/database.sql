-- =====================================================
-- DATABASE COMPLETO - Data Sistemas (MySQL/MariaDB)
-- Execute este script para criar o banco do zero
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- =====================================================
-- Tabela: admins (usuários do sistema)
-- =====================================================
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `key` VARCHAR(255) NOT NULL,
  `creditos` INT(11) NOT NULL DEFAULT 0,
  `rank` VARCHAR(20) DEFAULT 'revendedor' COMMENT 'dono, master, revendedor',
  `pin` VARCHAR(255) DEFAULT NULL COMMENT 'PIN de 4 dígitos para confirmação',
  `session_token` TEXT DEFAULT NULL,
  `last_active` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ip_address` TEXT DEFAULT NULL,
  `profile_photo` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `criado_por` INT(11) DEFAULT NULL COMMENT 'ID do admin que criou este usuário',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_email` (`email`),
  KEY `idx_rank` (`rank`),
  KEY `idx_criado_por` (`criado_por`),
  KEY `idx_session_token` (`session_token`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Tabela: credit_transactions (transações de crédito)
-- =====================================================
CREATE TABLE IF NOT EXISTS `credit_transactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `from_admin_id` INT(11) DEFAULT NULL COMMENT 'NULL para recargas',
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
-- Tabela: pix_payments (pagamentos PIX)
-- =====================================================
CREATE TABLE IF NOT EXISTS `pix_payments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin_id` INT(11) NOT NULL,
  `admin_name` TEXT NOT NULL,
  `transaction_id` TEXT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `credits` INT(11) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, PAID, EXPIRED, CANCELLED',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_status` (`status`),
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
-- Tabela: price_tiers (faixas de preço para créditos)
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

-- =====================================================
-- Tabela: noticias (notícias do sistema)
-- =====================================================
CREATE TABLE IF NOT EXISTS `noticias` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `titulo` TEXT NOT NULL,
  `informacao` TEXT NOT NULL,
  `data_post` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Tabela: service_usage (log de uso do sistema)
-- =====================================================
CREATE TABLE IF NOT EXISTS `service_usage` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `endpoint` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `admin_id` INT(11) DEFAULT NULL,
  `response_time` INT(11) DEFAULT NULL,
  `status_code` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_endpoint` (`endpoint`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Tabela: usuarios (CNH)
-- =====================================================
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `cpf` VARCHAR(14) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `uf` VARCHAR(2) NOT NULL,
  `sexo` CHAR(1) NOT NULL,
  `senha` VARCHAR(255) NOT NULL,
  `categoria` VARCHAR(10) NOT NULL,
  `data_validade` DATE NOT NULL,
  `data_emissao` DATE NOT NULL,
  `numero_habilitacao` VARCHAR(20) DEFAULT NULL,
  `numero_registro` VARCHAR(20) DEFAULT NULL,
  `nome_pai` VARCHAR(255) DEFAULT NULL,
  `nome_mae` VARCHAR(255) DEFAULT NULL,
  `data_nascimento` DATE DEFAULT NULL,
  `doc_identidade` VARCHAR(100) DEFAULT NULL,
  `foto` TEXT DEFAULT NULL,
  `pai` TEXT DEFAULT NULL,
  `mae` TEXT DEFAULT NULL,
  `obs` TEXT DEFAULT NULL,
  `hab` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `foto1` TEXT DEFAULT NULL,
  `foto2` TEXT DEFAULT NULL,
  `foto3` TEXT DEFAULT NULL,
  `codigo_seguranca` VARCHAR(50) DEFAULT NULL,
  `renach` VARCHAR(50) DEFAULT NULL,
  `qrcode` TEXT DEFAULT NULL,
  `data_expiracao` DATE DEFAULT NULL,
  `admin_id` INT(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_cpf` (`cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Tabela: rgs (RG Digital)
-- =====================================================
CREATE TABLE IF NOT EXISTS `rgs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nome_completo` VARCHAR(100) DEFAULT NULL,
  `nome_social` VARCHAR(100) DEFAULT NULL,
  `cpf` VARCHAR(20) DEFAULT NULL,
  `data_nascimento` DATE DEFAULT NULL,
  `naturalidade` VARCHAR(100) DEFAULT NULL,
  `genero` VARCHAR(10) DEFAULT NULL,
  `nacionalidade` VARCHAR(50) DEFAULT NULL,
  `validade` DATE DEFAULT NULL,
  `uf` VARCHAR(2) DEFAULT NULL,
  `data_emissao` DATE NOT NULL DEFAULT (CURDATE()),
  `local` VARCHAR(255) DEFAULT NULL,
  `orgao_expedidor` VARCHAR(255) DEFAULT NULL,
  `pai` VARCHAR(255) DEFAULT NULL,
  `mae` VARCHAR(255) DEFAULT NULL,
  `senha` VARCHAR(8) DEFAULT NULL,
  `foto` VARCHAR(255) DEFAULT NULL,
  `assinatura` VARCHAR(255) DEFAULT NULL,
  `admin_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `qrcode` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_rgs_expires_at` (`expires_at`),
  KEY `idx_rgs_admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- Tabela: carteira_estudante
-- =====================================================
CREATE TABLE IF NOT EXISTS `carteira_estudante` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nome` TEXT NOT NULL,
  `cpf` TEXT NOT NULL,
  `senha` TEXT NOT NULL,
  `rg` TEXT NOT NULL,
  `data_nascimento` DATE NOT NULL,
  `faculdade` TEXT NOT NULL,
  `graduacao` TEXT NOT NULL,
  `perfil_imagem` TEXT DEFAULT NULL,
  `admin_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `qrcode` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Faixas de preço padrão
INSERT INTO `price_tiers` (`id`, `min_qty`, `max_qty`, `price`, `is_active`) VALUES
(1, 50, 50, 1.40, 1),
(2, 100, 100, 1.30, 1),
(3, 200, 200, 1.20, 1),
(4, 300, 300, 1.10, 1),
(5, 500, 500, 1.00, 1)
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`);

-- Admin padrão (dono do sistema)
-- Senha: admin123 | Email: admin@admin.com
INSERT INTO `admins` (`id`, `nome`, `email`, `key`, `creditos`, `rank`, `criado_por`) VALUES
(1, 'Administrador', 'admin@admin.com', 'admin123', 999999, 'dono', NULL)
ON DUPLICATE KEY UPDATE `nome` = VALUES(`nome`);

COMMIT;

-- =====================================================
-- PRONTO! Banco criado com sucesso.
-- 
-- Login padrão:
--   Email: admin@admin.com
--   Senha: admin123
--   Rank: dono
-- =====================================================
