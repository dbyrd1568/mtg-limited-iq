import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetArg = process.argv[2];
const sqlFilePath = targetArg 
  ? (path.isAbsolute(targetArg) ? targetArg : path.join(process.cwd(), targetArg))
  : path.join(__dirname, 'migrations', '20260918000000_create_17lands_cache.sql');

if (!fs.existsSync(sqlFilePath)) {
  console.error(`Migration file not found at: ${sqlFilePath}`);
  process.exit(1);
}

console.log(`Loading migration SQL from: ${sqlFilePath}`);
const sql = fs.readFileSync(sqlFilePath, 'utf8');

const PROJECT_REF = 'irxgoelllogcyoiumxup';
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const dbUrl = process.env.DATABASE_URL;

async function runWithPg(connectionString: string) {
  console.log('Connecting to Supabase PostgreSQL database...');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected successfully. Executing migration SQL...');
  try {
    await client.query(sql);
    console.log('Migration executed successfully!');

    try {
      const res = await client.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
      `);
      console.log('Public tables:', res.rows.map(r => r.table_name).join(', '));
    } catch {}
  } finally {
    await client.end();
  }
}

async function runWithManagementApi(token: string) {
  console.log('Executing SQL via Supabase Management API...');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase Management API error (${res.status}): ${errorText}`);
  }

  console.log('Migration successfully executed via Management API!');
}

async function main() {
  if (accessToken) {
    await runWithManagementApi(accessToken);
  } else if (dbUrl) {
    await runWithPg(dbUrl);
  } else if (dbPassword) {
    const connectionStrings = [
      `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
      `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`
    ];

    let lastError: any = null;
    for (const conn of connectionStrings) {
      try {
        await runWithPg(conn);
        return;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  } else {
    console.error('Error: No administrative credentials found.');
    console.error('Provide SUPABASE_DB_PASSWORD, DATABASE_URL, or SUPABASE_ACCESS_TOKEN.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
