-- =============================================================================
-- Migration 042: Expands churches.theme_color with additional brand color
-- options: teal, maroon, slate, amber, cyan, olive, bronze, plum -- each
-- paired with the signature gilded gold accents and tailored sidebar gradients.
-- =============================================================================

ALTER TABLE churches
  MODIFY COLUMN theme_color ENUM(
    'blue', 'green', 'red', 'violet', 'orange', 'purple', 'pink',
    'teal', 'maroon', 'slate', 'amber', 'cyan', 'olive', 'bronze', 'plum'
  ) NOT NULL DEFAULT 'blue';
