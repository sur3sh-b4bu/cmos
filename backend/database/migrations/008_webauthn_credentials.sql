-- =============================================================================
-- Migration 008: WebAuthn / passkey credentials for biometric sign-in
--
-- Lets staff sign in with whatever the device already has -- Windows Hello
-- (face/fingerprint/PIN), Touch ID, or an Android fingerprint sensor -- instead
-- of retyping a password at a shared office machine.
--
-- No biometric data ever reaches the server. The sensor stays on the device;
-- all we store is the public half of a keypair and a signature counter.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_credentials (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  -- Base64URL credential id from the authenticator. VARCHAR(255) comfortably
  -- covers the 1023-byte spec maximum in practice while staying indexable.
  credential_id VARCHAR(255) NOT NULL,
  public_key BLOB NOT NULL,
  -- Replay guard: must never move backwards for a given credential.
  counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
  transports VARCHAR(120) NULL,
  device_label VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_user_credentials_credential_id (credential_id),
  KEY idx_user_credentials_user (user_id),
  CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Short-lived challenges. WebAuthn requires the server to remember the exact
-- random challenge it issued and reject any assertion that doesn't echo it,
-- which is what stops a captured response being replayed.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- Scope key: the user id for registration, the username for login (where we
  -- don't have a session yet).
  scope_key VARCHAR(150) NOT NULL,
  purpose ENUM('registration', 'authentication') NOT NULL,
  challenge VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webauthn_challenge_scope (scope_key, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
