
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const data = await sql`SELECT * FROM cash_entries ORDER BY timestamp DESC`;
    const mapped = data.map(e => ({
      id: e.id,
      sessionId: e.session_id,
      type: e.type,
      category: e.category,
      description: e.description,
      value: Number(e.value),
      timestamp: e.timestamp,
      method: e.method
    }));
    return res.status(200).json(mapped);
  }

  if (req.method === 'POST') {
    const e = req.body;
    try {
      await sql`
        INSERT INTO cash_entries (id, session_id, type, category, description, value, timestamp, method)
        VALUES (${e.id}, ${e.sessionId}, ${e.type}, ${e.category}, ${e.description}, ${e.value}, ${e.timestamp}, ${e.method})
      `;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
