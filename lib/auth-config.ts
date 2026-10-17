export const GOOGLE_ISSUER='https://accounts.google.com';
export function allowedStaffEmails(){return new Set((process.env.STAFF_ALLOWED_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)));}
export function appOrigin(){
  const url=new URL(process.env.APP_ORIGIN||'');
  const local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(local&&!process.env.VERCEL&&url.protocol==='http:')))throw new Error('APP_ORIGIN must be the canonical HTTPS application origin.');
  return url.origin;
}
export function authConfigured(){try{return !!(process.env.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com')&&process.env.GOOGLE_CLIENT_SECRET&&(process.env.SESSION_SECRET?.length||0)>=32&&allowedStaffEmails().size&&appOrigin());}catch{return false;}}
export function googleRedirectUri(){return appOrigin()+'/api/auth/google/callback';}
export type StaffIdentity={subject:string;email:string;displayName:string};
export function verifiedStaffIdentity(claims:Record<string,unknown>):StaffIdentity{
  if(claims.iss!==GOOGLE_ISSUER||typeof claims.sub!=='string'||!claims.sub||claims.email_verified!==true||typeof claims.email!=='string')throw new Error('A verified Google identity is required.');
  const email=claims.email.toLowerCase();if(!allowedStaffEmails().has(email))throw new Error('This Google account is not authorized for the event desk.');
  return {subject:claims.sub,email,displayName:typeof claims.name==='string'?claims.name.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,120)||email:email};
}
