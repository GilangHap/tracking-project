// Buat user admin:  node scripts/seed-admin.mjs <email> <password>
// Butuh env DATABASE_URL (contoh di bawah).
// Aman dijalankan ulang: email yang sama hanya update password + role.
import pg from "pg";
import bcrypt from "bcryptjs";

const [emailRaw, password] = process.argv.slice(2);
if (!emailRaw || !password || password.length < 8) {
  console.error("pakai: node scripts/seed-admin.mjs <email> <password-min-8>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("set env DATABASE_URL dulu");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const hash = await bcrypt.hash(password, 12);
await pool.query(
  `insert into public.users (email, password_hash, role)
   values (lower($1), $2, 'admin')
   on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin'`,
  [emailRaw.trim(), hash],
);
await pool.end();
console.log(`admin ok: ${emailRaw.trim().toLowerCase()}`);
