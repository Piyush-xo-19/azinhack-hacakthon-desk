import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if(!process.env.TURSO_DATABASE_URL)throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before applying migrations.');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
await client.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY NOT NULL,checksum TEXT NOT NULL,applied_at INTEGER NOT NULL)');
const files=(await readdir(new URL('../drizzle/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort();
for(const name of files){
  const sql=await readFile(new URL('../drizzle/'+name,import.meta.url),'utf8');const checksum=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
  const tx=await client.transaction('write');
  try{
    const existing=await tx.execute({sql:'SELECT checksum FROM schema_migrations WHERE name=?',args:[name]});
    if(existing.rows.length){if(existing.rows[0].checksum!==checksum)throw new Error('Applied migration changed: '+name);await tx.commit();continue;}
    for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await tx.execute(statement);
    await tx.execute({sql:'INSERT INTO schema_migrations (name,checksum,applied_at) VALUES (?,?,?)',args:[name,checksum,Date.now()]});await tx.commit();console.log('Applied '+name);
  }catch(error){await tx.rollback();throw error;}finally{tx.close();}
}
client.close();console.log('Database schema is up to date.');
