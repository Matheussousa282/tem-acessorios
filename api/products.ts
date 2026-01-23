
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL não configurada' });
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const products = await sql`SELECT * FROM products ORDER BY is_service ASC, name ASC`;
      const mapped = products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: p.category,
        costPrice: Number(p.cost_price || 0),
        salePrice: Number(p.sale_price || 0),
        stock: Number(p.stock || 0),
        image: p.image,
        brand: p.brand,
        unit: p.unit,
        location: p.location,
        isService: !!p.is_service,
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
      
      // Sanitização de dados para o banco
      const id = String(p.id);
      const name = String(p.name || '').toUpperCase();
      const sku = String(p.sku || `SKU-${Date.now()}`).toUpperCase();
      const barcode = String(p.barcode || '');
      const category = String(p.category || 'Geral');
      const costPrice = Number(p.costPrice) || 0;
      const salePrice = Number(p.salePrice) || 0;
      const stock = Number(p.stock) || 0;
      const image = String(p.image || '');
      const brand = String(p.brand || '');
      const unit = String(p.unit || 'UN');
      const location = String(p.location || 'GERAL');
      const isService = !!p.isService;
      const minStock = Number(p.minStock) || 0;
      const otherCostsPercent = Number(p.otherCostsPercent) || 0;
      const marginPercent = Number(p.marginPercent) || 0;
      const maxDiscountPercent = Number(p.maxDiscountPercent) || 0;
      const commissionPercent = Number(p.commissionPercent) || 0;
      const conversionFactor = Number(p.conversionFactor) || 1;
      const weight = String(p.weight || '0');

      await sql`
        INSERT INTO products (
          id, name, sku, barcode, category, cost_price, sale_price, stock, image, brand, unit, location, is_service,
          min_stock, other_costs_percent, margin_percent, max_discount_percent, commission_percent, conversion_factor, weight
        )
        VALUES (
          ${id}, ${name}, ${sku}, ${barcode}, ${category}, ${costPrice}, ${salePrice}, ${stock}, ${image}, ${brand}, ${unit}, ${location}, ${isService},
          ${minStock}, ${otherCostsPercent}, ${marginPercent}, ${maxDiscountPercent}, ${commissionPercent}, ${conversionFactor}, ${weight}
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

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error: any) {
    console.error("Erro na API de Produtos:", error);
    return res.status(500).json({ error: error.message });
  }
}
