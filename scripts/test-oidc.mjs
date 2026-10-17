import test from 'node:test';
import assert from 'node:assert/strict';
import * as oidc from 'openid-client';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {authorizationRequest,exchangeGoogleIdentity} from '../lib/google-oidc.ts';
import {GOOGLE_ISSUER,verifiedStaffIdentity} from '../lib/auth-config.ts';
import {sealTransaction,openTransaction} from '../lib/oidc-transaction.ts';
process.env.STAFF_ALLOWED_EMAILS='organizer@example.invalid';process.env.SESSION_SECRET='x'.repeat(64);
const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
const clientId='fixture.apps.googleusercontent.com',redirectUri='https://desk.example.invalid/api/auth/google/callback';
async function fixture(options={}){
  let transaction,tokenCalls=0;
  const metadata={issuer:GOOGLE_ISSUER,authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',id_token_signing_alg_values_supported:['RS256']};
  const config=new oidc.Configuration(metadata,clientId,{client_secret:'fixture-secret',id_token_signed_response_alg:'RS256'});
  config[oidc.customFetch]=async(url,init)=>{
    if(String(url)===metadata.jwks_uri)return Response.json({keys:[jwk]});
    assert.equal(String(url),metadata.token_endpoint);tokenCalls++;
    const body=new URLSearchParams(init.body);assert.equal(body.get('grant_type'),'authorization_code');assert.equal(body.get('code_verifier'),transaction.verifier);assert.equal(body.get('redirect_uri'),redirectUri);
    if(options.missingToken)return Response.json({access_token:'fixture-access',token_type:'Bearer',expires_in:3600});
    const claims={iss:GOOGLE_ISSUER,aud:clientId,sub:'google-subject-123',email:'organizer@example.invalid',email_verified:true,name:'Organizer',nonce:transaction.nonce,...options.claims};
    const signingKey=options.wrongSignature?(await generateKeyPair('RS256')).privateKey:privateKey;
    const token=await new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuedAt().setExpirationTime(options.expired?Math.floor(Date.now()/1000)-600:'5m').sign(signingKey);
    return Response.json({access_token:'fixture-access',token_type:'Bearer',expires_in:3600,id_token:token});
  };
  oidc.enableNonRepudiationChecks(config);
  const start=await authorizationRequest(config,redirectUri);transaction=start.transaction;
  const callback=new URL(redirectUri);callback.searchParams.set('code','fixture-code');callback.searchParams.set('state',transaction.state);
  return {config,start,callback,transaction,tokenCalls:()=>tokenCalls};
}
test('Google OIDC verifies a signed token, binds PKCE/state/nonce and uses the stable Google subject',async()=>{
  const f=await fixture();assert.equal(f.start.url.searchParams.get('scope'),'openid email profile');assert.equal(f.start.url.searchParams.get('code_challenge_method'),'S256');assert.equal(f.start.url.searchParams.get('code_challenge'),await oidc.calculatePKCECodeChallenge(f.transaction.verifier));
  assert.deepEqual(await exchangeGoogleIdentity(f.config,f.callback,f.transaction),{subject:'google-subject-123',email:'organizer@example.invalid',displayName:'Organizer'});
});
test('wrong state is rejected before exchanging the code',async()=>{const f=await fixture();f.callback.searchParams.set('state','wrong');await assert.rejects(()=>exchangeGoogleIdentity(f.config,f.callback,f.transaction));assert.equal(f.tokenCalls(),0);});
for(const [name,options]of Object.entries({nonce:{claims:{nonce:'wrong'}},audience:{claims:{aud:'another-client'}},issuer:{claims:{iss:'https://attacker.example.invalid'}},expiry:{expired:true},signature:{wrongSignature:true},missingToken:{missingToken:true}}))test('reject invalid Google token: '+name,async()=>{const f=await fixture(options);await assert.rejects(()=>exchangeGoogleIdentity(f.config,f.callback,f.transaction));});
test('unverified and unauthorized emails cannot become staff',async()=>{
  for(const claims of [{email_verified:false},{email:'outsider@example.invalid'}]){const f=await fixture({claims});await assert.rejects(()=>exchangeGoogleIdentity(f.config,f.callback,f.transaction));}
  assert.throws(()=>verifiedStaffIdentity({iss:GOOGLE_ISSUER,sub:'123',email:'organizer@example.invalid',email_verified:'true'}));
});
test('OIDC transaction is encrypted, tamper protected and bound to its redirect URI',async()=>{
  const f=await fixture();const sealed=await sealTransaction(f.transaction);assert.equal(sealed.includes(f.transaction.verifier),false);assert.deepEqual(await openTransaction(sealed),f.transaction);
  const parts=sealed.split('.');parts[3]=(parts[3][0]==='a'?'b':'a')+parts[3].slice(1);await assert.rejects(()=>openTransaction(parts.join('.')));
  const other=new URL(f.callback);other.hostname='attacker.example.invalid';await assert.rejects(()=>exchangeGoogleIdentity(f.config,other,f.transaction));
});
