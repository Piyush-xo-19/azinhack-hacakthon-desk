import { createClient, type Client, type InValue } from '@libsql/client';
let client: Client | undefined;
export function databaseClient() {
  const prefix = process.env.TURSO_ENV_PREFIX || '';
  const url = process.env[prefix+'TURSO_DATABASE_URL'];
  if (!url) throw new Error('Set TURSO_DATABASE_URL before accessing participant records.');
  if (process.env.VERCEL && (!/^libsql:\/\//.test(url) && !/^https:\/\//.test(url))) throw new Error('Vercel requires a remote durable database.');
  const authToken = process.env[prefix+'TURSO_AUTH_TOKEN'];
  if (process.env.VERCEL && !authToken) throw new Error('Set TURSO_AUTH_TOKEN for the hosted database.');
  return client ??= createClient({url,authToken});
}
class Statement {
  constructor(readonly sql: string, readonly args: InValue[] = []) {}
  bind(...args: InValue[]) { return new Statement(this.sql,args); }
  async all<T = Record<string,unknown>>() { const result = await databaseClient().execute(this); return {results:result.rows as unknown as T[]}; }
  async first<T = Record<string,unknown>>() { return (await this.all<T>()).results[0] ?? null; }
  async run() { const result = await databaseClient().execute(this); return {meta:{changes:result.rowsAffected}}; }
}
export function getDatabase() {
  return { prepare:(sql:string)=>new Statement(sql), batch:async(statements:Statement[])=>databaseClient().batch(statements,'write') };
}
