import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function resetDatabase() {
  try {
    await dataSource.initialize();
    console.log('Connected to database');

    // List all indexes
    const indexes = await dataSource.query(`
      SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
    `);
    console.log('Existing indexes:', indexes);

    // Drop specific problematic index if exists
    await dataSource.query(`DROP INDEX IF EXISTS "IDX_22ccc489ea19486e75064ffa6e" CASCADE;`);
    await dataSource.query(`DROP INDEX IF EXISTS "IDX_4de4098dcf7f8b99e1cd9b2d4b" CASCADE;`);
    
    // Drop all tables
    await dataSource.query(`DROP TABLE IF EXISTS user_tenant_map CASCADE;`);
    await dataSource.query(`DROP TABLE IF EXISTS admin_users CASCADE;`);
    await dataSource.query(`DROP TABLE IF EXISTS tenants CASCADE;`);

    // List remaining indexes
    const remainingIndexes = await dataSource.query(`
      SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
    `);
    console.log('Remaining indexes:', remainingIndexes);

    console.log('✅ Cleanup complete');
    await dataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetDatabase();
