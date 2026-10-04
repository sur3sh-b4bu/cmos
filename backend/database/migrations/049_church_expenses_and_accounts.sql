-- ==========================================================
-- 049_church_expenses_and_accounts.sql
-- Church Expenses, Account Heads, Ledger, and Monthly Financial Reports
-- ==========================================================

-- 1. Account Heads / Categories Table (Receipt & Payment Heads)
CREATE TABLE IF NOT EXISTS `account_heads` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT UNSIGNED NULL,
  `type` ENUM('receipt', 'payment') NOT NULL,
  `section` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `tamil_name` VARCHAR(255) NULL,
  `code` VARCHAR(100) NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `auto_source` VARCHAR(100) NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_heads_church_type` (`church_id`, `type`, `is_active`),
  INDEX `idx_heads_section` (`section`, `order_index`),
  CONSTRAINT `fk_heads_church` FOREIGN KEY (`church_id`) REFERENCES `churches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Expense / Income Journal Entries (Daily / Monthly Transactions)
CREATE TABLE IF NOT EXISTS `church_expenses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NULL,
  `entry_date` DATE NOT NULL,
  `month_year` VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  `type` ENUM('receipt', 'payment') NOT NULL,
  `head_id` INT UNSIGNED NULL,
  `head_name` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payment_method_id` INT UNSIGNED NULL,
  `voucher_no` VARCHAR(50) NULL,
  `paid_to` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `is_auto_sync` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  INDEX `idx_expenses_church_month` (`church_id`, `month_year`, `entry_date`),
  INDEX `idx_expenses_head` (`head_id`),
  INDEX `idx_expenses_deleted` (`deleted_at`),
  CONSTRAINT `fk_expenses_church` FOREIGN KEY (`church_id`) REFERENCES `churches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expenses_head` FOREIGN KEY (`head_id`) REFERENCES `account_heads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Monthly Financial Abstracts (Back Page Summary & Diocese Remittances)
CREATE TABLE IF NOT EXISTS `monthly_financial_abstracts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NULL,
  `month_year` VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  `opening_cash_hand` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `opening_cash_bank` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `opening_fixed_deposits` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `closing_cash_hand` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `closing_cash_bank` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `closing_fixed_deposits` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `receipts_specific_project` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payments_specific_project` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_stole_fees` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_mass_intentions` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_parish_contribution` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_diocesan_collection` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_monthly_allowance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_medical_allowance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_mission_conveyance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_any_other` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `priest_name` VARCHAR(255) NULL,
  `designation` VARCHAR(255) NULL,
  `unit_no` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_church_month_branch` (`church_id`, `month_year`, `branch_id`),
  CONSTRAINT `fk_abstract_church` FOREIGN KEY (`church_id`) REFERENCES `churches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seed Standard Default Account Heads (Matching Photo 1 Physical Ledger)
INSERT IGNORE INTO `account_heads` (`church_id`, `type`, `section`, `name`, `tamil_name`, `code`, `is_system`, `auto_source`, `order_index`) VALUES
-- RECEIPTS: Opening Balance
(NULL, 'receipt', 'Opening Balance', 'Cash in hand', 'கையிருப்பு ரொக்கம்', 'REC_OPEN_CASH', 1, 'opening_cash', 10),
(NULL, 'receipt', 'Opening Balance', 'Cash at Bank', 'வங்கி இருப்பு', 'REC_OPEN_BANK', 1, 'opening_bank', 20),
(NULL, 'receipt', 'Opening Balance', 'Fixed Deposits', 'வைப்பு நிதி', 'REC_OPEN_FD', 1, 'opening_fd', 30),

-- RECEIPTS: Other Income
(NULL, 'receipt', 'Other Income', 'Collection from Kurusadies', 'குருசடி காணிக்கை', 'REC_KURUSADIES', 1, NULL, 40),
(NULL, 'receipt', 'Other Income', 'Contribution from Village', 'கிராம பங்கு காணிக்கை', 'REC_VILLAGE', 1, 'contributions_village', 50),
(NULL, 'receipt', 'Other Income', 'Collection from Substations', 'கிளைப்பங்கு காணிக்கை', 'REC_SUBSTATIONS', 1, NULL, 60),
(NULL, 'receipt', 'Other Income', 'Voluntary Contribution', 'தன்னார்வ நன்கொடை', 'REC_VOLUNTARY', 1, 'contributions_voluntary', 70),
(NULL, 'receipt', 'Other Income', 'Dumb box collections', 'உண்டியல் காணிக்கை', 'REC_DUMB_BOX', 1, 'contributions_dumb_box', 80),
(NULL, 'receipt', 'Other Income', 'Family Subscription', 'குடும்ப மாதச் சந்தா', 'REC_FAMILY_SUB', 1, 'contributions_family_sub', 90),
(NULL, 'receipt', 'Other Income', 'Feast Collections', 'திருவிழா காணிக்கை', 'REC_FEAST', 1, 'contributions_feast', 100),
(NULL, 'receipt', 'Other Income', 'Liturgical services', 'வழிபாட்டு சேவைகள்', 'REC_LITURGICAL', 1, NULL, 110),
(NULL, 'receipt', 'Other Income', 'Other Collections', 'இதர காணிக்கைகள்', 'REC_OTHER_COLL', 1, NULL, 120),
(NULL, 'receipt', 'Other Income', 'Travel allowance from substations', 'கிளைப்பங்கு பயணப்படி', 'REC_TRAVEL_ALLOW', 1, NULL, 130),
(NULL, 'receipt', 'Other Income', 'Priest Allowance (Village)', 'பங்குத்தந்தை படி (கிராமம்)', 'REC_PRIEST_ALLOW_VILL', 1, NULL, 140),
(NULL, 'receipt', 'Other Income', 'Priest Allowance (Dio)', 'பங்குத்தந்தை படி (மறைமாவட்டம்)', 'REC_PRIEST_ALLOW_DIO', 1, NULL, 150),
(NULL, 'receipt', 'Other Income', 'GST Received', 'பெறப்பட்ட ஜி.எஸ்.டி', 'REC_GST', 1, NULL, 160),
(NULL, 'receipt', 'Other Income', 'Shops & Hall Rent', 'கடைகள் மற்றும் மண்டப வாடகை', 'REC_SHOPS_HALL', 1, NULL, 170),
(NULL, 'receipt', 'Other Income', 'House Rent', 'வீட்டு வாடகை', 'REC_HOUSE_RENT', 1, NULL, 180),
(NULL, 'receipt', 'Other Income', 'Interest Received', 'வட்டி வருமானம்', 'REC_INTEREST', 1, NULL, 190),
(NULL, 'receipt', 'Other Income', 'Schools & Others', 'பள்ளி மற்றும் இதர வருமானம்', 'REC_SCHOOLS', 1, NULL, 200),
(NULL, 'receipt', 'Other Income', 'Sunday Collection', 'ஞாயிறு காணிக்கை', 'REC_SUNDAY_COLL', 1, 'contributions_sunday', 210),
(NULL, 'receipt', 'Other Income', 'Sale of Materials', 'பொருட்கள் விற்பனை', 'REC_SALE_MAT', 1, NULL, 220),
(NULL, 'receipt', 'Other Income', 'Sale of Gifts & Mass Offerings thru Auction', 'ஏல விற்பனை வருமானம்', 'REC_AUCTION', 1, NULL, 230),

-- RECEIPTS: Payables
(NULL, 'receipt', 'Payables', 'Mass Received from People', 'மக்களிடமிருந்து திருப்பலி காணிக்கை', 'REC_MASS_PEOPLE', 1, 'mass_intentions_people', 240),
(NULL, 'receipt', 'Payables', 'Mass Received from Dio', 'மறைமாவட்ட திருப்பலி காணிக்கை', 'REC_MASS_DIO', 1, NULL, 250),
(NULL, 'receipt', 'Payables', 'Stole Fee', 'ஸ்தோல கட்டணம்', 'REC_STOLE_FEE', 1, NULL, 260),

-- RECEIPTS: Collections Made
(NULL, 'receipt', 'Collections Made', 'African Mission', 'ஆப்பிரிக்க மிஷன்', 'REC_AFRICAN_MISSION', 1, NULL, 270),
(NULL, 'receipt', 'Collections Made', 'Bible Sunday Collection', 'விவிலிய ஞாயிறு', 'REC_BIBLE_SUNDAY', 1, NULL, 280),
(NULL, 'receipt', 'Collections Made', 'Good Friday Collection', 'புனித வெள்ளி', 'REC_GOOD_FRIDAY', 1, NULL, 290),
(NULL, 'receipt', 'Collections Made', 'Holy Childhood Collection', 'புனித குழந்தைப்பருவம்', 'REC_HOLY_CHILDHOOD', 1, NULL, 300),
(NULL, 'receipt', 'Collections Made', 'Holy Land Collection', 'புனித பூமி', 'REC_HOLY_LAND', 1, NULL, 310),
(NULL, 'receipt', 'Collections Made', 'Holy See', 'தூய பேதுரு நிதி (ரோம்)', 'REC_HOLY_SEE', 1, NULL, 320),
(NULL, 'receipt', 'Collections Made', 'Mission Sunday Collection', 'மிஷன் ஞாயிறு', 'REC_MISSION_SUNDAY', 1, NULL, 330),
(NULL, 'receipt', 'Collections Made', 'St. Peter Pence', 'தூய பேதுரு காணிக்கை', 'REC_ST_PETER_PENCE', 1, NULL, 340),
(NULL, 'receipt', 'Collections Made', 'St. Peter the Apostle', 'திருத்தூதர் பேதுரு', 'REC_ST_PETER_APOSTLE', 1, NULL, 350),
(NULL, 'receipt', 'Collections Made', 'Vocation Day Collection', 'அழைத்தல் நாள்', 'REC_VOCATION_DAY', 1, NULL, 360),
(NULL, 'receipt', 'Collections Made', 'Project Income / Diocese', 'திட்ட வருமானம் / மறைமாவட்டம்', 'REC_PROJECT_INCOME', 1, NULL, 370),
(NULL, 'receipt', 'Collections Made', 'Any Other Source', 'பிற மூலங்கள்', 'REC_OTHER_SOURCE', 1, NULL, 380),
(NULL, 'receipt', 'Collections Made', 'Loans Received', 'பெறப்பட்ட கடன்கள்', 'REC_LOANS_RECV', 1, NULL, 390),
(NULL, 'receipt', 'Collections Made', 'Advances Received', 'பெறப்பட்ட முன்பணம்', 'REC_ADV_RECV', 1, NULL, 400),

-- PAYMENTS: Administrative Expenses
(NULL, 'payment', 'Administrative Expenses', 'Bank Charges', 'வங்கி கட்டணங்கள்', 'PAY_BANK_CHARGES', 1, NULL, 10),
(NULL, 'payment', 'Administrative Expenses', 'Books & Periodicals', 'புத்தகங்கள் மற்றும் இதழ்கள்', 'PAY_BOOKS', 1, NULL, 20),
(NULL, 'payment', 'Administrative Expenses', 'Charity & Donations', 'தர்மம் மற்றும் நன்கொடைகள்', 'PAY_CHARITY', 1, NULL, 30),
(NULL, 'payment', 'Administrative Expenses', 'Conveyance to guest priests', 'விருந்தினர் பங்குத்தந்தையர் பயணப்படி', 'PAY_GUEST_PRIESTS', 1, NULL, 40),
(NULL, 'payment', 'Administrative Expenses', 'Electricity, Telephone & Taxes', 'மின்சாரம், தொலைபேசி மற்றும் வரிகள்', 'PAY_EB_PHONE_TAX', 1, NULL, 50),
(NULL, 'payment', 'Administrative Expenses', 'Feast / Other Celebrations', 'திருவிழா மற்றும் பிற விழாக்கள்', 'PAY_FEAST_EXP', 1, NULL, 60),
(NULL, 'payment', 'Administrative Expenses', 'Liturgy', 'வழிபாட்டு செலவுகள்', 'PAY_LITURGY_EXP', 1, NULL, 70),
(NULL, 'payment', 'Administrative Expenses', 'Meeting expenses', 'கூட்டச் செலவுகள்', 'PAY_MEETING_EXP', 1, NULL, 80),
(NULL, 'payment', 'Administrative Expenses', 'Parish expenses', 'பங்கு நிர்வாகச் செலவுகள்', 'PAY_PARISH_EXP', 1, NULL, 90),
(NULL, 'payment', 'Administrative Expenses', 'Priest Allowance', 'பங்குத்தந்தை படி', 'PAY_PRIEST_ALLOW', 1, NULL, 100),
(NULL, 'payment', 'Administrative Expenses', 'Printing, Postage & Stationery', 'அச்சிடுதல், தபால் மற்றும் எழுதுபொருட்கள்', 'PAY_PRINTING', 1, NULL, 110),
(NULL, 'payment', 'Administrative Expenses', 'Purchase of Materials & Properties', 'பொருட்கள் மற்றும் சொத்துக்கள் வாங்குதல்', 'PAY_PURCHASE_MAT', 1, NULL, 120),
(NULL, 'payment', 'Administrative Expenses', 'School Expenses', 'பள்ளிச் செலவுகள்', 'PAY_SCHOOL_EXP', 1, NULL, 130),
(NULL, 'payment', 'Administrative Expenses', 'Travel expenses', 'பயணச் செலவுகள்', 'PAY_TRAVEL_EXP', 1, NULL, 140),
(NULL, 'payment', 'Administrative Expenses', 'Vehicle, Inverter & Generator', 'வாகனம், இன்வெர்ட்டர் & ஜெனரேட்டர்', 'PAY_VEHICLE_GEN', 1, NULL, 150),

-- PAYMENTS: Salary/Honorarium
(NULL, 'payment', 'Salary/Honorarium', 'Parish staff', 'பங்கு ஊழியர்கள் சம்பளம்', 'PAY_PARISH_STAFF', 1, NULL, 160),
(NULL, 'payment', 'Salary/Honorarium', 'School staff', 'பள்ளி ஊழியர்கள் சம்பளம்', 'PAY_SCHOOL_STAFF', 1, NULL, 170),

-- PAYMENTS: Masses
(NULL, 'payment', 'Masses', 'Mass paid to guest priests', 'விருந்தினர் தந்தையருக்கு திருப்பலி படி', 'PAY_MASS_GUEST', 1, NULL, 180),
(NULL, 'payment', 'Masses', 'Mass paid to Parish Priest', 'பங்குத்தந்தைக்கு திருப்பலி படி', 'PAY_MASS_PARISH_PRIEST', 1, NULL, 190),

-- PAYMENTS: Repairs & Maintenance
(NULL, 'payment', 'Repairs & Maintenance', 'Maintenance of Substations', 'கிளைப்பங்கு பராமரிப்பு', 'PAY_MAINT_SUBSTATION', 1, NULL, 200),
(NULL, 'payment', 'Repairs & Maintenance', 'Church & Kurusadies', 'ஆலயம் மற்றும் குருசடி பராமரிப்பு', 'PAY_MAINT_CHURCH', 1, NULL, 210),
(NULL, 'payment', 'Repairs & Maintenance', 'Presbytery', 'இல்லப் பராமரிப்பு', 'PAY_MAINT_PRESBYTERY', 1, NULL, 220),
(NULL, 'payment', 'Repairs & Maintenance', 'School Buildings', 'பள்ளிக் கட்டிடப் பராமரிப்பு', 'PAY_MAINT_SCHOOL', 1, NULL, 230),
(NULL, 'payment', 'Repairs & Maintenance', 'Other Maintenance', 'இதர பராமரிப்பு செலவுகள்', 'PAY_MAINT_OTHER', 1, NULL, 240),

-- PAYMENTS: Collections remitted to Diocese
(NULL, 'payment', 'Collections remitted to Diocese', 'African Mission Paid', 'ஆப்பிரிக்க மிஷன் செலுத்தியது', 'PAY_REMIT_AFRICAN', 1, NULL, 250),
(NULL, 'payment', 'Collections remitted to Diocese', 'Bible Sunday Collection Paid', 'விவிலிய ஞாயிறு செலுத்தியது', 'PAY_REMIT_BIBLE', 1, NULL, 260),
(NULL, 'payment', 'Collections remitted to Diocese', 'Bination to Diocese', 'இரு திருப்பலி படி மறைமாவட்டத்திற்கு', 'PAY_REMIT_BINATION', 1, NULL, 270),
(NULL, 'payment', 'Collections remitted to Diocese', 'Extra Masses paid to Diocese', 'கூடுதல் திருப்பலி மறைமாவட்டத்திற்கு', 'PAY_REMIT_EXTRA_MASS', 1, NULL, 280),
(NULL, 'payment', 'Collections remitted to Diocese', 'Good Friday Collection Paid', 'புனித வெள்ளி செலுத்தியது', 'PAY_REMIT_GOOD_FRIDAY', 1, NULL, 290),
(NULL, 'payment', 'Collections remitted to Diocese', 'Holy Childhood Collection Paid', 'புனித குழந்தைப்பருவம் செலுத்தியது', 'PAY_REMIT_HOLY_CHILD', 1, NULL, 300),
(NULL, 'payment', 'Collections remitted to Diocese', 'Holy Land Collection Paid', 'புனித பூமி செலுத்தியது', 'PAY_REMIT_HOLY_LAND', 1, NULL, 310),
(NULL, 'payment', 'Collections remitted to Diocese', 'Holy See Paid', 'தூய பேதுரு நிதி செலுத்தியது', 'PAY_REMIT_HOLY_SEE', 1, NULL, 320),
(NULL, 'payment', 'Collections remitted to Diocese', 'Mission Sunday Collection Paid', 'மிஷன் ஞாயிறு செலுத்தியது', 'PAY_REMIT_MISSION_SUN', 1, NULL, 330),
(NULL, 'payment', 'Collections remitted to Diocese', 'Parish Contribution', 'பங்கு பங்குத்தொகை செலுத்தியது', 'PAY_REMIT_PARISH_CONTRIB', 1, NULL, 340),
(NULL, 'payment', 'Collections remitted to Diocese', 'GST Paid', 'செலுத்தப்பட்ட ஜி.எஸ்.டி', 'PAY_REMIT_GST', 1, NULL, 350),
(NULL, 'payment', 'Collections remitted to Diocese', 'Shrine Contribution', 'திருத்தல பங்குத்தொகை', 'PAY_REMIT_SHRINE', 1, NULL, 360),
(NULL, 'payment', 'Collections remitted to Diocese', 'St. Peter Pence Paid', 'தூய பேதுரு காணிக்கை செலுத்தியது', 'PAY_REMIT_ST_PETER_PENCE', 1, NULL, 370),
(NULL, 'payment', 'Collections remitted to Diocese', 'St. Peter the Apostle Paid', 'திருத்தூதர் பேதுரு செலுத்தியது', 'PAY_REMIT_ST_PETER_APOSTLE', 1, NULL, 380),
(NULL, 'payment', 'Collections remitted to Diocese', 'Vocation Day Collection Paid', 'அழைத்தல் நாள் செலுத்தியது', 'PAY_REMIT_VOCATION', 1, NULL, 390),
(NULL, 'payment', 'Collections remitted to Diocese', 'Stole fee', 'ஸ்தோல கட்டணம் செலுத்தியது', 'PAY_REMIT_STOLE', 1, NULL, 400),
(NULL, 'payment', 'Collections remitted to Diocese', 'Loans Paid', 'செலுத்தப்பட்ட கடன்கள்', 'PAY_LOANS_PAID', 1, NULL, 410),
(NULL, 'payment', 'Collections remitted to Diocese', 'Advances Paid', 'செலுத்தப்பட்ட முன்பணம்', 'PAY_ADV_PAID', 1, NULL, 420),
(NULL, 'payment', 'Collections remitted to Diocese', 'Project Money spent', 'திட்டச் செலவு', 'PAY_PROJECT_SPENT', 1, NULL, 430),
(NULL, 'payment', 'Collections remitted to Diocese', 'Any Others', 'பிற செலவுகள்', 'PAY_OTHER_PAY', 1, NULL, 440),

-- PAYMENTS: Closing Balance
(NULL, 'payment', 'Closing Balance', 'Cash in hand', 'கையிருப்பு ரொக்கம்', 'PAY_CLOSE_CASH', 1, 'closing_cash', 450),
(NULL, 'payment', 'Closing Balance', 'Cash at bank', 'வங்கி இருப்பு', 'PAY_CLOSE_BANK', 1, 'closing_bank', 460),
(NULL, 'payment', 'Closing Balance', 'Fixed Deposits', 'வைப்பு நிதி', 'PAY_CLOSE_FD', 1, 'closing_fd', 470);

-- 5. Add Expense Permissions to permissions and role_permissions tables
INSERT IGNORE INTO `permissions` (`module`, `action`, `code`, `description`) VALUES
('expenses', 'view', 'expenses.view', 'View church expenses and accounts'),
('expenses', 'create', 'expenses.create', 'Create expense/income entries'),
('expenses', 'update', 'expenses.update', 'Update expense/income entries'),
('expenses', 'delete', 'expenses.delete', 'Delete expense/income entries'),
('expenses', 'print', 'expenses.print', 'Print financial journal and report'),
('expenses', 'export', 'expenses.export', 'Export financial records to Excel');

-- Assign to ADMIN, MASTER_ADMIN, and ACCOUNTANT
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r JOIN `permissions` p WHERE r.code IN ('ADMIN', 'ACCOUNTANT') AND p.module = 'expenses';
