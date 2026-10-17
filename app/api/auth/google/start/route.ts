import {NextResponse} from 'next/server';
import {appOrigin,authConfigured} from '@/lib/auth-config';
import {googleClient,authorizationRequest} from '@/lib/google-oidc';
import {FLOW_COOKIE,sealTransaction} from '@/lib/oidc-transaction';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
  if(!authConfigured())return NextResponse.json({error:'Google sign-in setup is pending.'},{status:503});
  try{
    const {url,transaction}=await authorizationRequest(await googleClient());
    const response=NextResponse.redirect(url,303);
    response.cookies.set(FLOW_COOKIE,await sealTransaction(transaction),{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/api/auth/google',maxAge:600});
    response.cookies.delete('azinhack_session');response.headers.set('Cache-Control','no-store');return response;
  }catch{return NextResponse.redirect(new URL('/login?error=unavailable',appOrigin()),303);}
}
