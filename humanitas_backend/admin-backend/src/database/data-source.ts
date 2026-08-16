import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
const sslEnabled = process.env.DATABASE_SSL === 'true';

let options: any = {
  type: 'postgres',
  entities: [resolve(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [resolve(__dirname, './migrations/*{.ts,.js}')],
  synchronize: false,
};

if (dbUrl) {
  options = {
    ...options,
    url: dbUrl,
    ssl: (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) ? false : (sslEnabled ? { rejectUnauthorized: false } : false),
  };
} else {
  options = {
    ...options,
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_password,
    database: process.env.DATABASE_NAME,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  };
}

export const AppDataSource = new DataSource(options);
