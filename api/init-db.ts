
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL não configurada' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Tabelas Base
    await sql`CREATE TABLE IF NOT EXISTS system_configs (id TEXT PRIMARY KEY, company_name TEXT DEFAULT 'ERP Retail', logo_url TEXT, tax_regime TEXT, allow_negative_stock BOOLEAN DEFAULT FALSE, return_period_days INTEGER DEFAULT 30)`;
    await sql`CREATE TABLE IF NOT EXISTS role_permissions (role TEXT PRIMARY KEY, permissions JSONB NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, password TEXT DEFAULT '123456', role TEXT NOT NULL, store_id TEXT, active BOOLEAN DEFAULT TRUE, avatar TEXT, commission_active BOOLEAN DEFAULT FALSE, commission_rate NUMERIC DEFAULT 0)`;
    await sql`CREATE TABLE IF NOT EXISTS establishments (id TEXT PRIMARY KEY, name TEXT NOT NULL, cnpj TEXT, location TEXT, has_stock_access BOOLEAN DEFAULT TRUE, active BOOLEAN DEFAULT TRUE, logo_url TEXT)`;
    
    // 2. Tabela de Produtos
    await sql`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, 
      name TEXT NOT NULL, 
      sku TEXT UNIQUE, 
      barcode TEXT, 
      category TEXT, 
      cost_price NUMERIC DEFAULT 0, 
      sale_price NUMERIC DEFAULT 0, 
      stock NUMERIC DEFAULT 0, 
      image TEXT, 
      brand TEXT, 
      unit TEXT DEFAULT 'UN', 
      location TEXT, 
      is_service BOOLEAN DEFAULT FALSE
    )`;

    // 3. Migração Resiliente de Colunas
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0`; } catch (e) {}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS other_costs_percent NUMERIC DEFAULT 0`; } catch (e) {}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_percent NUMERIC DEFAULT 0`; } catch (e) {}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS max_discount_percent NUMERIC DEFAULT 0`; } catch (e) {}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_percent NUMERIC DEFAULT 0`; } catch (e) {}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1`; } catch (e) {}
    try { await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight TEXT DEFAULT '0'`; } catch (e) {}

    // 4. Outras Tabelas
    await sql`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, date TEXT, due_date TEXT, description TEXT, store TEXT, category TEXT, status TEXT, value NUMERIC, shipping_value NUMERIC DEFAULT 0, type TEXT, method TEXT, client TEXT, client_id TEXT, vendor_id TEXT, cashier_id TEXT, items JSONB, installments INTEGER, auth_number TEXT, transaction_sku TEXT, card_operator_id TEXT, card_brand_id TEXT)`;
    try { await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cashier_id TEXT`; } catch (e) {}

    await sql`CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, birth_date TEXT, cpf_cnpj TEXT, zip_code TEXT, address TEXT, number TEXT, complement TEXT, neighborhood TEXT, city TEXT, state TEXT, notes TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, date TEXT NOT NULL, customer_id TEXT NOT NULL, customer_name TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, items JSONB NOT NULL, total_value NUMERIC NOT NULL, technician_name TEXT, expected_date TEXT, store TEXT NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS cash_sessions (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, store_name TEXT, register_name TEXT NOT NULL, opening_time TEXT, opening_operator_id TEXT, opening_operator_name TEXT, opening_value NUMERIC, closing_time TEXT, closing_operator_id TEXT, closing_operator_name TEXT, closing_value NUMERIC, status TEXT NOT NULL, price_table TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS cash_entries (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, category TEXT, description TEXT, value NUMERIC NOT NULL, timestamp TEXT NOT NULL, method TEXT)`;
    await sql`CREATE TABLE IF NOT EXISTS card_operators (id TEXT PRIMARY KEY, name TEXT NOT NULL, active BOOLEAN DEFAULT TRUE)`;
    await sql`CREATE TABLE IF NOT EXISTS card_brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, operator_id TEXT NOT NULL, active BOOLEAN DEFAULT TRUE)`;

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
