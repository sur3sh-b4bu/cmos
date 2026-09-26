-- =============================================================================
-- Migration 038: Server-side session auth (replaces JWT access/refresh tokens)
-- =============================================================================
-- Login now issues one opaque session id (httpOnly cookie, see authController.js's
-- SESSION_COOKIE_NAME) instead of a signed JWT access token + rotating refresh
-- token. `sessions` mirrors refresh_tokens' old shape, minus the rotation-chain
-- field (a session is looked up directly by its own hash, never rotated), plus
-- last_seen_at for the sliding-expiration touch authenticate.js does on every
-- request (see sessionRepository.touch).
--
-- Dropping refresh_tokens means every existing login session is invalidated --
-- everyone has to sign in again once this ships. Expected: there is nothing in
-- that table worth carrying over into a differently-shaped one.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  session_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_hash (session_hash),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS refresh_tokens;
