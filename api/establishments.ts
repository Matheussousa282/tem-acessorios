
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const data = await sql`SELECT * FROM establishments ORDER BY name ASC`;
    const mapped = data.map(e => ({
      id: e.id,
      name: e.name,
      cnpj: e.cnpj,
      location: e.location,
      hasStockAccess: e.has_stock_access,
      active: e.active,
      logoUrl: e.logo_url
    }));
    return res.status(200).json(mapped);
  }

  if (req.method === 'POST') {
    const e = req.body;
    try {
      await sql`
        INSERT INTO establishments (id, name, cnpj, location, has_stock_access, active, logo_url)
        VALUES (${e.id}, ${e.name}, ${e.cnpj || ''}, ${e.location || ''}, ${e.hasStockAccess !== undefined ? e.hasStockAccess : true}, ${e.active !== undefined ? e.active : true}, ${e.logoUrl || null})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          cnpj = EXCLUDED.cnpj,
          location = EXCLUDED.location,
          has_stock_access = EXCLUDED.has_stock_access,
          active = EXCLUDED.active,
          logo_url = EXCLUDED.logo_url
      `;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await sql`DELETE FROM establishments WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }
}
