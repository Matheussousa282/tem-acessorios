
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const data = await sql`SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT 5000`;
      const mapped = data.map(t => ({
        id: t.id,
        date: t.date,
        dueDate: t.due_date,
        description: t.description,
        store: t.store,
        category: t.category,
        status: t.status,
        value: Number(t.value),
        shippingValue: Number(t.shipping_value || 0),
        type: t.type,
        method: t.method,
        client: t.client,
        clientId: t.client_id,
        vendorId: t.vendor_id,
        cashierId: t.cashier_id,
        items: t.items,
        installments: t.installments,
        authNumber: t.auth_number,
        transactionSku: t.transaction_sku,
        cardOperatorId: t.card_operator_id,
        cardBrandId: t.card_brand_id
      }));
      return res.status(200).json(mapped);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const t = req.body;
    try {
      await sql`
        INSERT INTO transactions (
          id, date, due_date, description, store, category, status, value, shipping_value, type, method, 
          client, client_id, vendor_id, cashier_id, items, installments, auth_number, transaction_sku,
          card_operator_id, card_brand_id
        )
        VALUES (
          ${t.id}, ${t.date}, ${t.dueDate || t.date}, ${t.description}, ${t.store}, ${t.category}, ${t.status}, ${t.value}, ${t.shippingValue || 0}, ${t.type}, ${t.method}, 
          ${t.client}, ${t.clientId}, ${t.vendorId}, ${t.cashierId || null}, ${JSON.stringify(t.items)}, 
          ${t.installments || null}, ${t.authNumber || null}, ${t.transactionSku || null},
          ${t.cardOperatorId || null}, ${t.cardBrandId || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          client = EXCLUDED.client,
          client_id = EXCLUDED.client_id,
          vendor_id = EXCLUDED.vendor_id,
          cashier_id = EXCLUDED.cashier_id,
          status = EXCLUDED.status,
          value = EXCLUDED.value,
          items = EXCLUDED.items,
          method = EXCLUDED.method,
          installments = EXCLUDED.installments,
          auth_number = EXCLUDED.auth_number,
          transaction_sku = EXCLUDED.transaction_sku,
          card_operator_id = EXCLUDED.card_operator_id,
          card_brand_id = EXCLUDED.card_brand_id
      `;
      return res.status(200).json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}
