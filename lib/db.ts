import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { types } from "pg";

// Kembalikan timestamptz sebagai string ISO (bukan Date) agar konsisten
// dengan helper format WIB yang menerima string.
types.setTypeParser(1184, (v: string) => v);
types.setTypeParser(1114, (v: string) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => pool.query<T>(text, params as never[]),
};

/**
 * Jalankan kerja DB dalam SATU transaksi (tanpa klaim admin).
 */
export async function withTx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Jalankan kerja DB sebagai admin dalam SATU transaksi, dengan
 * app.admin_id di-set agar fungsi RPC mencatat audit dengan benar.
 */
export async function withAdmin<T>(
  adminId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.admin_id', $1, true)", [
      adminId,
    ]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
