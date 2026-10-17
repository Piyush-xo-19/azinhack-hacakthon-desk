import {createHash} from 'node:crypto';
import {EncryptJWT,jwtDecrypt} from 'jose';
import type {OidcTransaction} from './google-oidc';
export const FLOW_COOKIE='azinhack_google_flow';
function key(){if((process.env.SESSION_SECRET?.length||0)<32)throw new Error('Session secret is not configured.');return createHash('sha256').update('azinhack-google-flow:'+process.env.SESSION_SECRET).digest();}
export async function sealTransaction(transaction:OidcTransaction){return new EncryptJWT({...transaction}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuer('azinhack-google-flow').setAudience('google-callback').setIssuedAt().setExpirationTime('10m').encrypt(key());}
export async function openTransaction(value:string){
  const {payload}=await jwtDecrypt(value,key(),{keyManagementAlgorithms:['dir'],contentEncryptionAlgorithms:['A256GCM'],issuer:'azinhack-google-flow',audience:'google-callback'});
  if(['state','nonce','verifier','redirectUri'].some(k=>typeof payload[k]!=='string'||!payload[k]))throw new Error('Invalid OIDC transaction.');
  return {state:payload.state,nonce:payload.nonce,verifier:payload.verifier,redirectUri:payload.redirectUri} as OidcTransaction;
}
