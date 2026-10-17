// Run locally. Passwords are hidden and only a salted hash is saved.
import { createInterface } from 'node:readline/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
const location=new URL('../.env.local',import.meta.url);
let source='';try{source=await readFile(location,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const previous=parseEnv(source);
if(!process.stdin.isTTY)throw new Error('Run setup in an interactive terminal so your password can stay hidden.');
const rl=createInterface({input:process.stdin,output:process.stdout});
const email=(await rl.question('Organizer email: ')).trim().toLowerCase();rl.close();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n'"#]/.test(email))throw new Error('Enter a valid email address.');
async function hidden(prompt){
  process.stdout.write(prompt);let value='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    function finish(error){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value);}
    function onData(chunk){for(const c of chunk){if(c==='\u0003')return finish(new Error('Setup cancelled.'));if(c==='\r'||c==='\n')return finish();if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;}}
    process.stdin.on('data',onData);
  });
}
const password=await hidden('Organizer password (12+ characters): ');
if(password.length<12||password.length>1024)throw new Error('Use a password between 12 and 1,024 characters.');
if(password!==await hidden('Confirm password: '))throw new Error('Passwords did not match.');
const salt=randomBytes(16).toString('hex');const passwordHash='scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex');
let staff=[];try{staff=JSON.parse(previous.STAFF_ACCOUNTS_BASE64?Buffer.from(previous.STAFF_ACCOUNTS_BASE64,'base64').toString('utf8'):previous.STAFF_ACCOUNTS||'[]');}catch{throw new Error('Existing staff account configuration is invalid. Fix it before running setup.');}
if(!Array.isArray(staff))throw new Error('Existing STAFF_ACCOUNTS must be an array.');
staff=[...staff.filter(a=>a.email!==email),{email,name:email,passwordHash}];
function set(name,value){const line=name+'='+value;const pattern=new RegExp('^'+name+'=.*$','m');source=pattern.test(source)?source.replace(pattern,()=>line):source.trimEnd()+'\n'+line+'\n';}
// Use an unquoted base64 JSON value to avoid dotenv quote/comment ambiguities.
set('STAFF_ACCOUNTS_BASE64',Buffer.from(JSON.stringify(staff)).toString('base64'));
if((previous.SESSION_SECRET?.length||0)<32)set('SESSION_SECRET',randomBytes(48).toString('hex'));
await writeFile(location,source,{mode:0o600});
console.log('Organizer credentials saved to ignored .env.local. The password itself was not saved.');
console.log('In Vercel add SESSION_SECRET and STAFF_ACCOUNTS_BASE64 using the values from this file.');
