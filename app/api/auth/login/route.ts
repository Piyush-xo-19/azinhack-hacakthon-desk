import { accounts, authConfigured, createSession, passwordMatches } from '@/lib/staff-auth';
import { getDatabase } from '@/lib/database';
import { createHash } from 'node:crypto';
import { isSameOrigin } from '@/lib/request';
export const runtime = 'nodejs';
export async function POST(request:Request) {
  if(!isSameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  if(!authConfigured())return Response.json({error:'Organizer login is not configured yet.'},{status:503});
  try {
    const body=await request.json();
    if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>1024)return Response.json({error:'Enter your staff email and password.'},{status:400});
    const email=body.email.trim().toLowerCase(), now=Date.now(), cutoff=now-15*60*1000;
    const key=createHash('sha256').update(email).digest('hex');
    const rate=await getDatabase().prepare('INSERT INTO login_attempts (key,attempts,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start < ? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END RETURNING attempts').bind(key,now,cutoff,cutoff).first<{attempts:number}>();
    if(!rate||rate.attempts>10)return Response.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429});
    const account=accounts().find(a=>a.email.toLowerCase()===email);
    const hash=account?.passwordHash||'scrypt$00000000000000000000000000000000$'+'0'.repeat(128);
    const valid=await passwordMatches(body.password,hash);
    if(!account||!valid)return Response.json({error:'Email or password is incorrect.'},{status:401});
    await createSession(account);
    await getDatabase().prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
    return Response.json({ok:true});
  } catch { return Response.json({error:'Login is temporarily unavailable. Check the database connection.'},{status:503}); }
}
