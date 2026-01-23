
import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  const sql = neon(process.env.DATABASE_URL!);

  if (req.method === 'GET') {
    const data = await sql`SELECT * FROM customers ORDER BY name ASC`;
    const mapped = data.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      birthDate: c.birth_date,
      cpfCnpj: c.cpf_cnpj,
      zipCode: c.zip_code,
      address: c.address,
      number: c.number,
      complement: c.complement,
      neighborhood: c.neighborhood,
      city: c.city,
      state: c.state,
      notes: c.notes
    }));
    return res.status(200).json(mapped);
  }

  if (req.method === 'POST') {
    const c = req.body;
    await sql`
      INSERT INTO customers (id, name, email, phone, birth_date, cpf_cnpj, zip_code, address, number, complement, neighborhood, city, state, notes)
      VALUES (${c.id}, ${c.name}, ${c.email}, ${c.phone}, ${c.birthDate}, ${c.cpfCnpj}, ${c.zipCode}, ${c.address}, ${c.number}, ${c.complement}, ${c.neighborhood}, ${c.city}, ${c.state}, ${c.notes})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        birth_date = EXCLUDED.birth_date,
        cpf_cnpj = EXCLUDED.cpf_cnpj,
        zip_code = EXCLUDED.zip_code,
        address = EXCLUDED.address,
        number = EXCLUDED.number,
        complement = EXCLUDED.complement,
        neighborhood = EXCLUDED.neighborhood,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        notes = EXCLUDED.notes
    `;
    return res.status(200).json({ success: true });
  }
}
