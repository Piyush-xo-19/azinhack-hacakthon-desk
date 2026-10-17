import * as oidc from 'openid-client';
import {GOOGLE_ISSUER,authConfigured,googleRedirectUri,verifiedStaffIdentity} from './auth-config.ts';
export type OidcTransaction={state:string;nonce:string;verifier:string;redirectUri:string};
let configuration:Promise<oidc.Configuration>|undefined;
export async function googleClient(){
  if(!authConfigured())throw new Error('Google OIDC is not configured.');
  if(!configuration)configuration=oidc.discovery(new URL(GOOGLE_ISSUER),process.env.GOOGLE_CLIENT_ID!,{client_secret:process.env.GOOGLE_CLIENT_SECRET!,id_token_signed_response_alg:'RS256'}).then(config=>{oidc.enableNonRepudiationChecks(config);return config;}).catch(error=>{configuration=undefined;throw error;});
  return configuration;
}
export async function authorizationRequest(config:oidc.Configuration,redirectUri=googleRedirectUri()){
  const transaction:OidcTransaction={state:oidc.randomState(),nonce:oidc.randomNonce(),verifier:oidc.randomPKCECodeVerifier(),redirectUri};
  const url=oidc.buildAuthorizationUrl(config,{redirect_uri:redirectUri,scope:'openid email profile',response_type:'code',code_challenge_method:'S256',code_challenge:await oidc.calculatePKCECodeChallenge(transaction.verifier),state:transaction.state,nonce:transaction.nonce,prompt:'select_account'});
  return {url,transaction};
}
export async function exchangeGoogleIdentity(config:oidc.Configuration,currentUrl:URL,transaction:OidcTransaction){
  if(currentUrl.origin+currentUrl.pathname!==transaction.redirectUri)throw new Error('Unexpected callback URL.');
  const tokens=await oidc.authorizationCodeGrant(config,currentUrl,{pkceCodeVerifier:transaction.verifier,expectedState:transaction.state,expectedNonce:transaction.nonce,idTokenExpected:true});
  const claims=tokens.claims();if(!claims)throw new Error('Google did not provide an ID token.');
  // openid-client validates issuer, audience, expiry, nonce and signature before this allowlist check.
  return verifiedStaffIdentity(claims);
}
