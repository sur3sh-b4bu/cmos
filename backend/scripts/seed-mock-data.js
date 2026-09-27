/**
 * Comprehensive Mock Data Seeder for Church Office Management System (COMS).
 * Populates rich, multi-page realistic mock data across ALL tables & pages.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = 'root',
  DB_NAME = 'coms_db',
} = process.env;

async function run() {
  console.log('🚀 Running complete mock data seeder across all modules...');
  
  // Require and run the comprehensive seeder
  require('../database/seed_dashboard_mock_data.js');
}

run();
