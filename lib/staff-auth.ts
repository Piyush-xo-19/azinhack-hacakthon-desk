import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {SignJWT,jwtVerify} from 'jose';
import {allowedStaffEmails,appOrigin,authConfigured,type StaffIdentity} from './auth-config';
import {FLOW_COOKIE} from './oidc-transaction';
export {authConfigured} from './auth-config';
export const SESSION_COOKIE='azinhack_oidc_session';
function key(){if(!authConfigured())throw new Error('Google OIDC is not configured.');return new TextEncoder().encode(process.env.SESSION_SECRET!);}
export async function createSession(identity:StaffIdentity){
  if(!allowedStaffEmails().has(identity.email))throw new Error('Staff access is not authorized.');
  const token=await new SignJWT({email:identity.email,name:identity.displayName,provider:'google',auth_version:1}).setProtectedHeader({alg:'HS256'}).setSubject(identity.subject).setIssuer('azinhack-google-oidc').setAudience('azinhack-staff').setIssuedAt().setExpirationTime('12h').sign(key());
  const jar=await cookies();jar.set(SESSION_COOKIE,token,{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/',maxAge:43200});jar.delete('azinhack_session');
}
export async function clearSession(){const jar=await cookies();jar.delete(SESSION_COOKIE);jar.delete('azinhack_session');jar.set(FLOW_COOKIE,'',{path:'/api/auth/google',maxAge:0});}
export async function getStaffUser(){
  if(!authConfigured())return null;const token=(await cookies()).get(SESSION_COOKIE)?.value;if(!token)return null;
  try{
    const{payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'azinhack-google-oidc',audience:'azinhack-staff'});
    if(payload.provider!=='google'||payload.auth_version!==1||typeof payload.sub!=='string'||typeof payload.email!=='string'||!allowedStaffEmails().has(payload.email))return null;
    return{userId:payload.sub,email:payload.email,displayName:typeof payload.name==='string'?payload.name:payload.email};
  }catch{return null;}
}
export async function requireStaffUser(){const user=await getStaffUser();if(!user)redirect('/login');return user;}
