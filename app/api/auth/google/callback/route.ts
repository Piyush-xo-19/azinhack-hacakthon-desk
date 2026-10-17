import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {appOrigin,authConfigured,googleRedirectUri} from '@/lib/auth-config';
import {googleClient,exchangeGoogleIdentity} from '@/lib/google-oidc';
import {FLOW_COOKIE,openTransaction} from '@/lib/oidc-transaction';
import {createSession} from '@/lib/staff-auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(!authConfigured())return NextResponse.json({error:'Google sign-in setup is pending.'},{status:503});
  const jar=await cookies();const flow=jar.get(FLOW_COOKIE)?.value;
  jar.set(FLOW_COOKIE,'',{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/api/auth/google',maxAge:0});
  function failure(){return NextResponse.redirect(new URL('/login?error=google',appOrigin()),303);}
  if(!flow)return failure();
  try{
    const transaction=await openTransaction(flow);
    if(transaction.redirectUri!==googleRedirectUri())return failure();
    // Use the configured public origin rather than a proxy's internal request hostname.
    const callback=new URL(googleRedirectUri());callback.search=new URL(request.url).search;
    const identity=await exchangeGoogleIdentity(await googleClient(),callback,transaction);
    await createSession(identity);
    const response=NextResponse.redirect(new URL('/',appOrigin()),303);response.headers.set('Cache-Control','no-store');return response;
  }catch{return failure();}
}
