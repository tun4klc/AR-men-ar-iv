import "server-only";
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

/** Kontrol Merkezi'nin kendi veritabanı. Menü Platformu'nun veritabanıyla hiçbir bağlantısı yoktur. */
export function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL tanımlı değil");
    // Boş, 0 veya geçersiz değer havuzu kilitlemesin: varsayılan 3.
    const max = Math.max(1, Number.parseInt(process.env.DB_POOL_MAX ?? "", 10) || 3);
    sql = postgres(url, { max, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  }
  return sql;
}
