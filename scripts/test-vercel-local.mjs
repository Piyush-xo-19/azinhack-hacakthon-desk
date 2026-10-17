// Isolated production-server QA. No real contacts or sender credentials are used.
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.sites-runtime',{recursive:true});
const dir=await mkdtemp(path.resolve('.sites-runtime/vercel-qa-'));
const email='organizer-qa@example.invalid',password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex');
const account={email,name:'QA Organizer',passwordHash:'scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex')};
const env={...process.env,NODE_ENV:'production',TURSO_DATABASE_URL:pathToFileURL(path.join(dir,'qa.db')).href,TURSO_AUTH_TOKEN:'',SESSION_SECRET:randomBytes(48).toString('hex'),STAFF_ACCOUNTS:'[]',STAFF_ACCOUNTS_BASE64:Buffer.from(JSON.stringify([account])).toString('base64'),DESK_TEST_URL:'http://127.0.0.1:3101',DESK_TEST_EMAIL:email,DESK_TEST_PASSWORD:password,RESEND_API_KEY:'',WHATSAPP_ACCESS_TOKEN:''};
if(process.argv.includes('--prefix')){env.TURSO_ENV_PREFIX='QA_';env.QA_TURSO_DATABASE_URL=env.TURSO_DATABASE_URL;env.QA_TURSO_AUTH_TOKEN='';env.TURSO_DATABASE_URL='file:unselected-db-must-not-be-used';}
const migration=spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);console.log(migration.stdout);
const again=spawnSync(process.execPath,['scripts/migrate.mjs'],{env,encoding:'utf8'});assert.equal(again.status,0,again.stderr);
let logs='';const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{env,stdio:['ignore','pipe','pipe']});
server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(env.DESK_TEST_URL+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,logs);
  const spoof=await fetch(env.DESK_TEST_URL+'/api/desk',{headers:{'oai-authenticated-user-id':'fake','oai-authenticated-user-email':email}});assert.equal(spoof.status,401);
  const csrf=await fetch(env.DESK_TEST_URL+'/api/auth/login',{method:'POST',headers:{Origin:'https://other.example.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
  for(let i=0;i<11;i++){const r=await fetch(env.DESK_TEST_URL+'/api/auth/login',{method:'POST',headers:{Origin:env.DESK_TEST_URL,'Content-Type':'application/json'},body:JSON.stringify({email:'blocked@example.invalid',password:'wrong'})});assert.equal(r.status,i===10?429:401);}
  const smoke=spawnSync(process.execPath,['scripts/smoke-local.mjs'],{env,encoding:'utf8'});assert.equal(smoke.status,0,smoke.stdout+smoke.stderr);console.log(smoke.stdout);
  console.log('PASS: production staff login, spoofed-header rejection, CSRF protection, login rate limiting and repeatable migrations.');
}finally{server.kill();}
