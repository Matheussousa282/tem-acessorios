
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const data = await sql`SELECT * FROM products ORDER BY name ASC`;
      const mapped = data.map(p => ({
        id: p.id,
        name: String(p.name || ''),
        sku: String(p.sku || ''),
        barcode: String(p.barcode || ''),
        category: String(p.category || 'Geral'),
        costPrice: Number(p.cost_price || 0),
        salePrice: Number(p.sale_price || 0),
        stock: Number(p.stock || 0),
        image: String(p.image || ''),
        brand: String(p.brand || ''),
        unit: String(p.unit || 'UN'),
        location: String(p.location || 'GERAL'),
        isService: !!p.is_service,
        minStock: Number(p.min_stock || 0),
        marginPercent: Number(p.margin_percent || 0)
      }));
      return res.status(200).json(mapped);
    }

    if (req.method === 'POST') {
      const p = req.body;
      const fields = {
        id: String(p.id),
        name: String(p.name || '').toUpperCase(),
        sku: String(p.sku || `SKU-${Date.now()}`).toUpperCase(),
        barcode: String(p.barcode || ''),
        category: String(p.category || 'Geral'),
        cost_price: Number(p.costPrice) || 0,
        sale_price: Number(p.salePrice) || 0,
        stock: Number(p.stock) || 0,
        image: String(p.image || ''),
        brand: String(p.brand || ''),
        unit: String(p.unit || 'UN'),
        location: String(p.location || 'GERAL'),
        is_service: !!p.isService,
        min_stock: Number(p.minStock) || 0,
        margin_percent: Number(p.marginPercent) || 0
      };

      await sql`
        INSERT INTO products (
          id, name, sku, barcode, category, cost_price, sale_price, stock, image, brand, unit, location, is_service, min_stock, margin_percent
        )
        VALUES (
          ${fields.id}, ${fields.name}, ${fields.sku}, ${fields.barcode}, ${fields.category}, ${fields.cost_price}, ${fields.sale_price}, ${fields.stock}, 
          ${fields.image}, ${fields.brand}, ${fields.unit}, ${fields.location}, ${fields.is_service}, ${fields.min_stock}, ${fields.margin_percent}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          sku = EXCLUDED.sku,
          barcode = EXCLUDED.barcode,
          category = EXCLUDED.category,
          cost_price = EXCLUDED.cost_price,
          sale_price = EXCLUDED.sale_price,
          stock = EXCLUDED.stock,
          image = EXCLUDED.image,
          brand = EXCLUDED.brand,
          unit = EXCLUDED.unit,
          location = EXCLUDED.location,
          is_service = EXCLUDED.is_service,
          min_stock = EXCLUDED.min_stock,
          margin_percent = EXCLUDED.margin_percent
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM products WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error("API Products Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
