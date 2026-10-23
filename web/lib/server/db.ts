import "server-only";
import pg from "pg";
import { config } from "./config";

let pool: pg.Pool | undefined;

export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  return pool;
}
