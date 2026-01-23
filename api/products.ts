
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const data = await sql`SELECT * FROM products ORDER BY name ASC`;
      const mapped = data.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || '',
        category: p.category || 'Geral',
        costPrice: Number(p.cost_price || 0),
        salePrice: Number(p.sale_price || 0),
        stock: Number(p.stock || 0),
        image: p.image || '',
        brand: p.brand || '',
        unit: p.unit || 'UN',
        location: p.location || '',
        isService: !!p.is_service,
        minStock: Number(p.min_stock || 0),
        otherCostsPercent: Number(p.other_costs_percent || 0),
        marginPercent: Number(p.margin_percent || 0),
        maxDiscountPercent: Number(p.max_discount_percent || 0),
        commissionPercent: Number(p.commission_percent || 0),
        conversionFactor: Number(p.conversion_factor || 1),
        weight: String(p.weight || '0')
      }));
      return res.status(200).json(mapped);
    }

    if (req.method === 'POST') {
      const p = req.body;
      await sql`
        INSERT INTO products (
          id, name, sku, barcode, category, cost_price, sale_price, stock, image, brand, unit, location, is_service,
          min_stock, other_costs_percent, margin_percent, max_discount_percent, commission_percent, conversion_factor, weight
        )
        VALUES (
          ${p.id}, ${String(p.name).toUpperCase()}, ${String(p.sku).toUpperCase()}, ${p.barcode || ''}, ${p.category || 'Geral'}, 
          ${Number(p.costPrice) || 0}, ${Number(p.salePrice) || 0}, ${Number(p.stock) || 0}, ${p.image || ''}, ${p.brand || ''}, 
          ${p.unit || 'UN'}, ${p.location || 'GERAL'}, ${!!p.isService}, ${Number(p.minStock) || 0}, 
          ${Number(p.otherCostsPercent) || 0}, ${Number(p.marginPercent) || 0}, ${Number(p.maxDiscountPercent) || 0}, 
          ${Number(p.commissionPercent) || 0}, ${Number(p.conversionFactor) || 1}, ${String(p.weight || '0')}
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
          other_costs_percent = EXCLUDED.other_costs_percent,
          margin_percent = EXCLUDED.margin_percent,
          max_discount_percent = EXCLUDED.max_discount_percent,
          commission_percent = EXCLUDED.commission_percent,
          conversion_factor = EXCLUDED.conversion_factor,
          weight = EXCLUDED.weight
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
    return res.status(500).json({ error: error.message });
  }
}
