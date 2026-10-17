import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
const scrypt = promisify(scryptCallback);
const COOKIE = 'azinhack_session';
export type Account = { email:string; name:string; passwordHash:string };
export function accounts():Account[] {
  try {
    const rows:unknown = JSON.parse(process.env.STAFF_ACCOUNTS_BASE64 ? Buffer.from(process.env.STAFF_ACCOUNTS_BASE64,'base64').toString('utf8') : process.env.STAFF_ACCOUNTS || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter((a):a is Account => !!a && typeof a.email==='string' && typeof a.name==='string' && /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(a.passwordHash));
  } catch { return []; }
}
export function authConfigured() { return (process.env.SESSION_SECRET?.length ?? 0)>=32 && accounts().length>0; }
function key() { if (!authConfigured()) throw new Error('Staff authentication is not configured.'); return new TextEncoder().encode(process.env.SESSION_SECRET!); }
const fingerprint=(a:Account)=>createHash('sha256').update(a.passwordHash).digest('hex');
export async function passwordMatches(password:string, hash:string) {
  const [,salt,expected] = hash.split('$');
  if (!salt || !expected) return false;
  const actual = await scrypt(password,salt,64) as Buffer;
  const target = Buffer.from(expected,'hex');
  return actual.length===target.length && timingSafeEqual(actual,target);
}
export async function createSession(account:Account) {
  const token = await new SignJWT({email:account.email,version:fingerprint(account)}).setProtectedHeader({alg:'HS256'}).setSubject(account.email).setIssuer('azinhack').setAudience('azinhack-staff').setIssuedAt().setExpirationTime('12h').sign(key());
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:43200});
}
export async function clearSession() { (await cookies()).delete(COOKIE); }
export async function getStaffUser() {
  if (!authConfigured()) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const {payload} = await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'azinhack',audience:'azinhack-staff'});
    const account = accounts().find(a=>a.email===payload.sub);
    if (!account || payload.version!==fingerprint(account)) return null;
    return {userId:account.email,email:account.email,displayName:account.name};
  } catch { return null; }
}
export async function requireStaffUser() { const user=await getStaffUser(); if(!user)redirect('/login'); return user; }
