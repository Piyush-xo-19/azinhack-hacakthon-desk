// Isolated production-server QA. Synthetic app sessions test session enforcement;
// test-oidc.mjs separately exercises the real authorization grant/JWKS verification.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {SignJWT} from 'jose';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.sites-runtime',{recursive:true});const dir=await mkdtemp(path.resolve('.sites-runtime/oidc-qa-'));
const email='organizer-qa@example.invalid',secret=randomBytes(48).toString('hex'),base='http://127.0.0.1:3101';
const key=new TextEncoder().encode(secret);
const token=await new SignJWT({email,name:'QA Organizer',provider:'google',auth_version:1}).setProtectedHeader({alg:'HS256'}).setSubject('synthetic-google-subject').setIssuer('azinhack-google-oidc').setAudience('azinhack-staff').setIssuedAt().setExpirationTime('10m').sign(key);
const legacy=await new SignJWT({email,version:'legacy-hash'}).setProtectedHeader({alg:'HS256'}).setSubject(email).setIssuer('azinhack').setAudience('azinhack-staff').setIssuedAt().setExpirationTime('10m').sign(key);
const env={...process.env,NODE_ENV:'production',APP_ORIGIN:base,GOOGLE_CLIENT_ID:'fixture.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fixture-secret',STAFF_ALLOWED_EMAILS:email,SESSION_SECRET:secret,TURSO_DATABASE_URL:pathToFileURL(path.join(dir,'qa.db')).href,TURSO_AUTH_TOKEN:'',STAFF_ACCOUNTS:'[]',STAFF_ACCOUNTS_BASE64:'',DESK_TEST_URL:base,DESK_TEST_EMAIL:email,DESK_TEST_COOKIE:'azinhack_oidc_session='+token,RESEND_API_KEY:'',WHATSAPP_ACCESS_TOKEN:''};
if(process.argv.includes('--prefix')){env.TURSO_ENV_PREFIX='QA_';env.QA_TURSO_DATABASE_URL=env.TURSO_DATABASE_URL;env.QA_TURSO_AUTH_TOKEN='';env.TURSO_DATABASE_URL='file:unselected-db-must-not-be-used';}
for(let i=0;i<2;i++){const migration=spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);}
let logs='';const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{env,stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,logs);
 const loginHtml=await(await fetch(base+'/login')).text();assert.match(loginHtml,/Continue with Google/);assert.doesNotMatch(loginHtml,/type="password"/);
 for(const headers of [{'oai-authenticated-user-id':'fake','oai-authenticated-user-email':email},{Cookie:'azinhack_session='+legacy},{Cookie:'azinhack_oidc_session='+legacy}])assert.equal((await fetch(base+'/api/desk',{headers})).status,401);
 const removed=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password:'old-password'})});assert.equal(removed.status,410);assert.equal(removed.headers.get('set-cookie'),null);
 const callback=await fetch(base+'/api/auth/google/callback?code=fake&state=fake',{redirect:'manual'});assert.equal(callback.status,303);assert.match(callback.headers.get('location'),/login\?error=google/);
 const invalidFlow=await fetch(base+'/api/auth/google/callback?code=fake&state=fake',{headers:{Cookie:'azinhack_google_flow=invalid'},redirect:'manual'});assert.equal(invalidFlow.status,303);assert.doesNotMatch(invalidFlow.headers.get('set-cookie')||'',/azinhack_oidc_session=/);
 const csrf=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:env.DESK_TEST_COOKIE,Origin:'https://other.example.invalid'}});assert.equal(csrf.status,403);
 const smoke=spawnSync(process.execPath,['scripts/smoke-local.mjs'],{env,encoding:'utf8'});assert.equal(smoke.status,0,smoke.stdout+smoke.stderr);console.log(smoke.stdout);
 const dashboard=await fetch(base+'/',{headers:{Cookie:env.DESK_TEST_COOKIE}});assert.equal(dashboard.status,200);
 const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:env.DESK_TEST_COOKIE,Origin:base}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/azinhack_oidc_session=;/);
 console.log('PASS: Google-only login UI, retired password endpoint, rejected legacy sessions, rejected spoofed identities, callback binding, logout CSRF and event records.');
}finally{server.kill();}
