
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DB URL missing' });
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const data = await sql`SELECT * FROM users ORDER BY name ASC`;
    const mapped = data.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      storeId: u.store_id,
      active: u.active,
      avatar: u.avatar,
      commissionActive: u.commission_active,
      commissionRate: Number(u.commission_rate || 0)
    }));
    return res.status(200).json(mapped);
  }

  if (req.method === 'POST') {
    const u = req.body;
    try {
      await sql`
        INSERT INTO users (id, name, email, password, role, store_id, active, avatar, commission_active, commission_rate)
        VALUES (
          ${u.id}, 
          ${u.name}, 
          ${u.email}, 
          ${u.password || '123456'}, 
          ${u.role}, 
          ${u.storeId || 'matriz'}, 
          ${u.active !== undefined ? u.active : true}, 
          ${u.avatar || ''},
          ${u.commissionActive || false},
          ${u.commissionRate || 0}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          active = EXCLUDED.active,
          avatar = EXCLUDED.avatar,
          commission_active = EXCLUDED.commission_active,
          commission_rate = EXCLUDED.commission_rate
      `;
      return res.status(200).json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    await sql`DELETE FROM users WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }
}
