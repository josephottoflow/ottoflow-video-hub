import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const res = await pool.query(
  "UPDATE jobs SET status = 'error' WHERE row_index = 10 AND status = 'processing'"
);
console.log("Updated rows:", res.rowCount);

const rows = await pool.query(
  "SELECT row_index, topic, status FROM jobs ORDER BY created_at DESC LIMIT 6"
);
rows.rows.forEach(r => console.log(r.row_index, r.topic?.substring(0,40), r.status));

await pool.end();
