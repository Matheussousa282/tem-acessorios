
// Script de inicialização do banco de dados Neon com todas as tabelas necessárias para o ERP.
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Tabela de Produtos
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        barcode TEXT,
        category TEXT,
        cost_price DECIMAL(10,2),
        sale_price DECIMAL(10,2),
        stock DECIMAL(10,3),
        image TEXT,
        brand TEXT,
        unit TEXT,
        location TEXT,
        is_service BOOLEAN DEFAULT FALSE,
        min_stock DECIMAL(10,3),
        margin_percent DECIMAL(10,2)
      )
    `;

    // Tabela de Clientes
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        birth_date TEXT,
        cpf_cnpj TEXT,
        zip_code TEXT,
        address TEXT,
        number TEXT,
        complement TEXT,
        neighborhood TEXT,
        city TEXT,
        state TEXT,
        notes TEXT
      )
    `;

    // Tabela de Usuários
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT,
        store_id TEXT,
        active BOOLEAN DEFAULT TRUE,
        avatar TEXT,
        commission_active BOOLEAN DEFAULT FALSE,
        commission_rate DECIMAL(10,2)
      )
    `;

    // Tabela de Estabelecimentos
    await sql`
      CREATE TABLE IF NOT EXISTS establishments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cnpj TEXT,
        location TEXT,
        has_stock_access BOOLEAN DEFAULT TRUE,
        active BOOLEAN DEFAULT TRUE,
        logo_url TEXT
      )
    `;

    // Tabela de Transações
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT,
        due_date TEXT,
        description TEXT,
        store TEXT,
        category TEXT,
        status TEXT,
        value DECIMAL(10,2),
        shipping_value DECIMAL(10,2),
        type TEXT,
        method TEXT,
        client TEXT,
        client_id TEXT,
        vendor_id TEXT,
        cashier_id TEXT,
        items JSONB,
        installments INTEGER,
        auth_number TEXT,
        transaction_sku TEXT,
        card_operator_id TEXT,
        card_brand_id TEXT
      )
    `;

    // Tabela de Sessões de Caixa
    await sql`
      CREATE TABLE IF NOT EXISTS cash_sessions (
        id TEXT PRIMARY KEY,
        store_id TEXT,
        store_name TEXT,
        register_name TEXT,
        opening_time TEXT,
        opening_operator_id TEXT,
        opening_operator_name TEXT,
        opening_value DECIMAL(10,2),
        closing_time TEXT,
        closing_operator_id TEXT,
        closing_operator_name TEXT,
        closing_value DECIMAL(10,2),
        status TEXT,
        price_table TEXT
      )
    `;

    // Tabela de Lançamentos de Caixa
    await sql`
      CREATE TABLE IF NOT EXISTS cash_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES cash_sessions(id),
        type TEXT,
        category TEXT,
        description TEXT,
        value DECIMAL(10,2),
        timestamp TEXT,
        method TEXT
      )
    `;

    // Tabela de Operadoras de Cartão
    await sql`
      CREATE TABLE IF NOT EXISTS card_operators (
        id TEXT PRIMARY KEY,
        name TEXT,
        active BOOLEAN DEFAULT TRUE
      )
    `;

    // Tabela de Bandeiras de Cartão
    await sql`
      CREATE TABLE IF NOT EXISTS card_brands (
        id TEXT PRIMARY KEY,
        name TEXT,
        operator_id TEXT REFERENCES card_operators(id),
        active BOOLEAN DEFAULT TRUE
      )
    `;

    // Tabela de Ordens de Serviço
    await sql`
      CREATE TABLE IF NOT EXISTS service_orders (
        id TEXT PRIMARY KEY,
        date TEXT,
        customer_id TEXT,
        customer_name TEXT,
        description TEXT,
        status TEXT,
        items JSONB,
        total_value DECIMAL(10,2),
        technician_name TEXT,
        expected_date TEXT,
        store TEXT
      )
    `;

    // Tabela de Permissões
    await sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT PRIMARY KEY,
        permissions JSONB
      )
    `;

    // Inserir Admin Padrão se não existir
    const admins = await sql`SELECT * FROM users WHERE role = 'ADMINISTRADOR'`;
    if (admins.length === 0) {
      await sql`
        INSERT INTO users (id, name, email, password, role, active)
        VALUES ('admin', 'Administrador', 'admin@erp.com', 'admin123', 'ADMINISTRADOR', TRUE)
      `;
    }

    // Inserir Loja Matriz se não existir
    const stores = await sql`SELECT * FROM establishments`;
    if (stores.length === 0) {
      await sql`
        INSERT INTO establishments (id, name, location, active)
        VALUES ('matriz', 'Matriz Principal', 'Endereço Principal', TRUE)
      `;
    }

    return res.status(200).json({ success: true, message: 'Database initialized' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
