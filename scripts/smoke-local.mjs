// Local-only integration QA. Uses synthetic contacts; does not send messages.
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
const base = process.env.DESK_TEST_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('QA requires a local preview.');
if(!process.env.DESK_TEST_EMAIL||!process.env.DESK_TEST_COOKIE)throw new Error('Run through the isolated OIDC production test harness.');
const cookie=process.env.DESK_TEST_COOKIE;
async function call(body,authenticated=true){const r=await fetch(base+'/api/desk',{method:body?'POST':'GET',headers:{...(authenticated?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
assert.equal((await call(undefined,false)).status,401);
const email='local-qa@example.invalid';
const row={name:'Local QA Participant',email,phone:'919999999991',team:'QA only'};
assert.equal((await call({type:'import',rows:[{...row,email:'invalid'}]})).status,400);
assert.equal((await call({type:'import',rows:[row,row]})).status,400);
assert.equal((await call({type:'import',rows:[row]})).status,200);
const find=async()=>(await call()).data.participants.find(p=>p.email===email);
const p=await find();assert.ok(p.token);assert.ok(p.id);
assert.equal((await call({type:'claim',token:'unknown',action:'attendance'})).status,404);
assert.equal((await call({type:'claim',token:p.token,action:'lunch'})).status,409);
assert.equal((await call({type:'claim',token:p.token,action:'attendance'})).status,200);
const concurrent=await Promise.all([call({type:'claim',token:p.token,action:'lunch'}),call({type:'claim',token:p.token,action:'lunch'})]);
assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
assert.equal((await call({type:'claim',token:p.token,action:'goodies'})).status,200);
assert.equal((await call({type:'claim',token:p.token,action:'goodies'})).status,409);
assert.equal((await call({type:'import',rows:[{...row,name:'Local QA Updated'}]})).status,200);
const after=await find();assert.equal(after.id,p.id);assert.equal(after.token,p.token);assert.equal(after.claims.length,3);
assert.ok(after.claims.every(c=>c.actor===process.env.DESK_TEST_EMAIL&&Number.isFinite(c.at)));
const payload=`HACKPASS:${p.token}`;const png=await QRCode.toBuffer(payload,{width:720,margin:4,errorCorrectionLevel:'M'});const image=PNG.sync.read(png);assert.equal(jsQR(new Uint8ClampedArray(image.data),image.width,image.height).data,payload);
console.log('PASS: auth, import validation, attendance prerequisite, concurrent duplicate rejection, stable re-import IDs/QR/claims, operator timestamps and QR round-trip.');
console.log('Synthetic local QA row needs cleanup: local-qa@example.invalid');

