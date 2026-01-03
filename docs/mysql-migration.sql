-- ============================================
-- MIGRAÇÃO PARA MYSQL - Data Sistemas
-- ============================================
-- Este arquivo contém todas as tabelas e procedures
-- adaptadas de PostgreSQL para MySQL
-- ============================================

-- Configurações iniciais
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "-03:00";

-- ============================================
-- TABELAS
-- ============================================

-- Tabela de administradores
CREATE TABLE `admins` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `key` VARCHAR(255) NOT NULL,
  `pin` VARCHAR(10) DEFAULT NULL,
  `creditos` INT NOT NULL DEFAULT 0,
  `rank` ENUM('dono', 'master', 'revendedor') DEFAULT 'revendedor',
  `profile_photo` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `session_token` VARCHAR(255) DEFAULT NULL,
  `criado_por` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_active` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email` (`email`),
  INDEX `idx_rank` (`rank`),
  INDEX `idx_criado_por` (`criado_por`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de transações de crédito
CREATE TABLE `credit_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `from_admin_id` INT DEFAULT NULL,
  `to_admin_id` INT NOT NULL,
  `amount` INT NOT NULL,
  `unit_price` DECIMAL(10,2) DEFAULT NULL,
  `total_price` DECIMAL(10,2) DEFAULT NULL,
  `transaction_type` ENUM('recharge', 'transfer') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_from_admin` (`from_admin_id`),
  INDEX `idx_to_admin` (`to_admin_id`),
  INDEX `idx_type` (`transaction_type`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`from_admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`to_admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de metas mensais
CREATE TABLE `monthly_goals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `month` INT NOT NULL,
  `year` INT NOT NULL,
  `target_revenue` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_month_year` (`month`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de pagamentos PIX
CREATE TABLE `pix_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `admin_id` INT NOT NULL,
  `admin_name` VARCHAR(255) NOT NULL,
  `transaction_id` VARCHAR(255) NOT NULL UNIQUE,
  `amount` DECIMAL(10,2) NOT NULL,
  `credits` INT NOT NULL,
  `status` ENUM('PENDING', 'PAID', 'EXPIRED', 'CANCELLED') DEFAULT 'PENDING',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_admin_id` (`admin_id`),
  INDEX `idx_transaction_id` (`transaction_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de faixas de preço
CREATE TABLE `price_tiers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `min_qty` INT NOT NULL,
  `max_qty` INT DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STORED PROCEDURES (equivalentes às funções)
-- ============================================

DELIMITER //

-- Validar login
CREATE PROCEDURE `validate_login`(
  IN p_email VARCHAR(255),
  IN p_key VARCHAR(255)
)
BEGIN
  SELECT id, nome, email, creditos, `rank`, profile_photo
  FROM admins
  WHERE email = p_email AND `key` = p_key
  LIMIT 1;
END //

-- Validar PIN
CREATE PROCEDURE `validate_pin`(
  IN p_admin_id INT,
  IN p_pin VARCHAR(10),
  OUT p_valid BOOLEAN
)
BEGIN
  SELECT COUNT(*) > 0 INTO p_valid
  FROM admins
  WHERE id = p_admin_id AND pin = p_pin;
END //

-- Definir PIN do admin
CREATE PROCEDURE `set_admin_pin`(
  IN p_admin_id INT,
  IN p_pin VARCHAR(10)
)
BEGIN
  UPDATE admins SET pin = p_pin WHERE id = p_admin_id;
  SELECT ROW_COUNT() > 0 AS success;
END //

-- Recarregar créditos
CREATE PROCEDURE `recharge_credits`(
  IN p_admin_id INT,
  IN p_amount INT,
  IN p_unit_price DECIMAL(10,2),
  IN p_total_price DECIMAL(10,2)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT FALSE AS success;
  END;

  START TRANSACTION;
  
  -- Atualiza créditos do admin
  UPDATE admins 
  SET creditos = creditos + p_amount, 
      last_active = NOW() 
  WHERE id = p_admin_id;
  
  -- Registra transação
  INSERT INTO credit_transactions (to_admin_id, amount, unit_price, total_price, transaction_type)
  VALUES (p_admin_id, p_amount, p_unit_price, p_total_price, 'recharge');
  
  COMMIT;
  SELECT TRUE AS success;
END //

-- Transferir créditos
CREATE PROCEDURE `transfer_credits`(
  IN p_from_admin_id INT,
  IN p_to_admin_id INT,
  IN p_amount INT
)
BEGIN
  DECLARE v_from_balance INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SELECT FALSE AS success, 'Erro na transferência' AS message;
  END;

  START TRANSACTION;
  
  -- Verifica saldo (com lock)
  SELECT creditos INTO v_from_balance 
  FROM admins 
  WHERE id = p_from_admin_id 
  FOR UPDATE;
  
  IF v_from_balance < p_amount THEN
    ROLLBACK;
    SELECT FALSE AS success, 'Saldo insuficiente' AS message;
  ELSE
    -- Remove créditos do remetente
    UPDATE admins 
    SET creditos = creditos - p_amount, 
        last_active = NOW() 
    WHERE id = p_from_admin_id;
    
    -- Adiciona créditos ao destinatário
    UPDATE admins 
    SET creditos = creditos + p_amount, 
        last_active = NOW() 
    WHERE id = p_to_admin_id;
    
    -- Registra transação
    INSERT INTO credit_transactions (from_admin_id, to_admin_id, amount, transaction_type)
    VALUES (p_from_admin_id, p_to_admin_id, p_amount, 'transfer');
    
    COMMIT;
    SELECT TRUE AS success, 'Transferência realizada' AS message;
  END IF;
END //

-- Buscar admins por nome ou email
CREATE PROCEDURE `search_admins`(
  IN p_search VARCHAR(255)
)
BEGIN
  SELECT id, nome, email, creditos, `rank`, profile_photo, created_at
  FROM admins
  WHERE nome LIKE CONCAT('%', p_search, '%')
     OR email LIKE CONCAT('%', p_search, '%')
  ORDER BY nome
  LIMIT 20;
END //

-- Listar revendedores de um master
CREATE PROCEDURE `get_resellers_by_master`(
  IN p_master_id INT
)
BEGIN
  SELECT id, nome, email, creditos, created_at, last_active
  FROM admins
  WHERE criado_por = p_master_id AND `rank` = 'revendedor'
  ORDER BY created_at DESC;
END //

-- Estatísticas do dashboard
CREATE PROCEDURE `get_dashboard_stats`()
BEGIN
  -- Total de admins por rank
  SELECT 
    COUNT(*) AS total,
    SUM(CASE WHEN `rank` = 'master' THEN 1 ELSE 0 END) AS masters,
    SUM(CASE WHEN `rank` = 'revendedor' THEN 1 ELSE 0 END) AS revendedores,
    SUM(creditos) AS total_creditos
  FROM admins;
END //

-- Receita mensal
CREATE PROCEDURE `get_monthly_revenue`(
  IN p_year INT,
  IN p_month INT
)
BEGIN
  SELECT 
    COALESCE(SUM(total_price), 0) AS revenue
  FROM credit_transactions
  WHERE transaction_type = 'recharge'
    AND YEAR(created_at) = p_year
    AND MONTH(created_at) = p_month;
END //

DELIMITER ;

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Faixas de preço
INSERT INTO `price_tiers` (`min_qty`, `max_qty`, `price`) VALUES
(10, 10, 14.00),
(15, 15, 13.80),
(25, 25, 13.50),
(30, 30, 13.30),
(50, 50, 13.00),
(75, 75, 12.50),
(100, 100, 12.00),
(150, 150, 11.50),
(200, 200, 11.00),
(250, 250, 10.50),
(300, 300, 10.20),
(350, 350, 10.00),
(400, 400, 9.80),
(500, 500, 9.65);

-- Admin inicial (dono) - ALTERE A SENHA!
INSERT INTO `admins` (`nome`, `email`, `key`, `rank`, `creditos`) VALUES
('Administrador', 'admin@datasistemas.com', 'ALTERE_ESTA_SENHA', 'dono', 0);

COMMIT;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. SEGURANÇA: MySQL não tem RLS nativo. Você deve implementar
--    verificações de permissão na sua API/backend.
--
-- 2. AUTENTICAÇÃO: Implemente verificação de sessão no backend
--    antes de executar qualquer procedure.
--
-- 3. API RECOMENDADA: Use Node.js + Express ou PHP para criar
--    endpoints que chamam essas procedures.
--
-- 4. CONEXÃO: Use prepared statements para evitar SQL injection.
--
-- 5. BACKUP: Configure backup automático do banco de dados.
--
-- ============================================
