"use strict";
// Constants specific to self-hosted environments
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_DATABASE_NAME = exports.POSTGRES_USER_READ_ONLY = exports.POSTGRES_USER_READ_WRITE = exports.POSTGRES_PASSWORD = exports.POSTGRES_DATABASE = exports.POSTGRES_HOST = exports.POSTGRES_PORT = exports.ENCRYPTION_KEY = void 0;
exports.ENCRYPTION_KEY = process.env.PG_META_CRYPTO_KEY || 'SAMPLE_KEY';
exports.POSTGRES_PORT = process.env.POSTGRES_PORT || 5432;
exports.POSTGRES_HOST = process.env.POSTGRES_HOST || 'db';
exports.POSTGRES_DATABASE = process.env.POSTGRES_DB || 'postgres';
exports.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
exports.POSTGRES_USER_READ_WRITE = process.env.POSTGRES_USER_READ_WRITE || 'supabase_admin';
exports.POSTGRES_USER_READ_ONLY = process.env.POSTGRES_USER_READ_ONLY || 'supabase_read_only_user';
exports.TEMPLATE_DATABASE_NAME = process.env.TEMPLATE_DATABASE_NAME;
