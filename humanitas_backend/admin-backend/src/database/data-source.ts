import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

import { buildAdminSslConfig } from './ssl-config.helper';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
const sslEnabled = process.env.DATABASE_SSL === 'true';
const sslConfig = buildAdminSslConfig({
  dbUrl,
  sslEnabled,
  ca: process.env.DATABASE_SSL_CA,
  explicitReject: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
});

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
    ssl: sslConfig,
  };
} else {
  options = {
    ...options,
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_password,
    database: process.env.DATABASE_NAME,
    ssl: sslConfig,
  };
}

export const AppDataSource = new DataSource(options);
