
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL não configurada' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Garante a existência da tabela
    await sql`
      CREATE TABLE IF NOT EXISTS system_configs (
        id TEXT PRIMARY KEY,
        company_name TEXT DEFAULT 'ERP Retail',
        logo_url TEXT,
        tax_regime TEXT DEFAULT 'Simples Nacional',
        allow_negative_stock BOOLEAN DEFAULT FALSE,
        return_period_days INTEGER DEFAULT 30
      )
    `;

    if (req.method === 'GET') {
      const data = await sql`SELECT * FROM system_configs WHERE id = 'main'`;
      if (data.length === 0) {
        const initial = { id: 'main', company_name: 'ERP Retail', tax_regime: 'Simples Nacional', return_period_days: 30 };
        await sql`INSERT INTO system_configs (id, company_name, tax_regime, return_period_days) VALUES ('main', 'ERP Retail', 'Simples Nacional', 30)`;
        return res.status(200).json({
          companyName: initial.company_name,
          logoUrl: '',
          taxRegime: initial.tax_regime,
          allowNegativeStock: false,
          returnPeriodDays: 30
        });
      }
      
      const config = data[0];
      return res.status(200).json({
        companyName: config.company_name,
        logoUrl: config.logo_url,
        taxRegime: config.tax_regime,
        allowNegativeStock: config.allow_negative_stock,
        returnPeriodDays: config.return_period_days
      });
    }

    if (req.method === 'POST') {
      const { companyName, logoUrl, taxRegime, allowNegativeStock, returnPeriodDays } = req.body;
      
      await sql`
        INSERT INTO system_configs (id, company_name, logo_url, tax_regime, allow_negative_stock, return_period_days)
        VALUES ('main', ${companyName}, ${logoUrl}, ${taxRegime}, ${allowNegativeStock}, ${returnPeriodDays || 30})
        ON CONFLICT (id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          logo_url = EXCLUDED.logo_url,
          tax_regime = EXCLUDED.tax_regime,
          allow_negative_stock = EXCLUDED.allow_negative_stock,
          return_period_days = EXCLUDED.return_period_days
      `;
      
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
