
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const products = await sql`SELECT * FROM products ORDER BY is_service ASC, name ASC`;
    const mapped = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      category: p.category,
      costPrice: Number(p.cost_price),
      salePrice: Number(p.sale_price),
      stock: p.stock,
      image: p.image,
      brand: p.brand,
      unit: p.unit,
      location: p.location,
      isService: p.is_service,
      minStock: Number(p.min_stock || 0),
      otherCostsPercent: Number(p.other_costs_percent || 0),
      marginPercent: Number(p.margin_percent || 0),
      maxDiscountPercent: Number(p.max_discount_percent || 0),
      commissionPercent: Number(p.commission_percent || 0),
      conversionFactor: Number(p.conversion_factor || 1),
      weight: p.weight
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
        ${p.id}, ${p.name}, ${p.sku}, ${p.barcode}, ${p.category}, ${p.costPrice}, ${p.salePrice}, ${p.stock}, ${p.image}, ${p.brand}, ${p.unit}, ${p.location}, ${p.isService || false},
        ${p.minStock || 0}, ${p.otherCostsPercent || 0}, ${p.marginPercent || 0}, ${p.maxDiscountPercent || 0}, ${p.commissionPercent || 0}, ${p.conversionFactor || 1}, ${p.weight || 0}
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
}
