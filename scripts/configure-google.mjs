// Import Google's downloaded Web OAuth client JSON into ignored local configuration.
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
const file=process.argv[2],email=process.argv[3]?.trim().toLowerCase();
if(!file||!email||!/^[^\s@'"#]+@[^\s@'"#]+\.[^\s@'"#]+$/.test(email))throw new Error('Usage: node scripts/configure-google.mjs PATH_TO_GOOGLE_WEB_CLIENT_JSON ORGANIZER_EMAIL');
const target=new URL('../.env.local',import.meta.url);let source='';try{source=await readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
const previous=parseEnv(source),origin=previous.APP_ORIGIN||'https://azinhack-hacakthon-desk-yd7c.vercel.app';
const credentials=JSON.parse(await readFile(file,'utf8')).web;
if(!credentials?.client_id?.endsWith('.apps.googleusercontent.com')||!credentials.client_secret)throw new Error('Download credentials for a Google Web application OAuth client.');
if(!credentials.redirect_uris?.includes(origin+'/api/auth/google/callback'))throw new Error('Register this exact redirect URI in Google first: '+origin+'/api/auth/google/callback');
const values={APP_ORIGIN:origin,GOOGLE_CLIENT_ID:credentials.client_id,GOOGLE_CLIENT_SECRET:credentials.client_secret,STAFF_ALLOWED_EMAILS:email,SESSION_SECRET:previous.SESSION_SECRET?.length>=32?previous.SESSION_SECRET:randomBytes(48).toString('hex')};
for(const[name,value]of Object.entries(values)){if(/[\r\n#'"\s]/.test(value))throw new Error('Unexpected characters in '+name);const line=name+'='+value,pattern=new RegExp('^'+name+'=.*$','m');source=pattern.test(source)?source.replace(pattern,()=>line):source.trimEnd()+'\n'+line+'\n';}
source=source.replace(/^STAFF_ACCOUNTS(?:_BASE64)?=.*\r?\n?/gm,'');
await writeFile(target,source,{mode:0o600});console.log('Google OAuth configuration saved to ignored .env.local. No client secrets were printed.');
