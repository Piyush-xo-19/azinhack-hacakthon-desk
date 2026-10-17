import { getDatabase } from '@/lib/database';
import { getStaffUser } from '@/lib/staff-auth';
import { isSameOrigin } from '@/lib/request';
import { actions, normalizeRow, validateRow, type ImportRow } from '@/lib/event';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const db = getDatabase;
function settings() {
  const e = process.env;
  return { email: !!(e.RESEND_API_KEY && e.EMAIL_FROM), whatsapp: !!(e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_TEMPLATE_NAME && e.WHATSAPP_GRAPH_VERSION) };
}
export async function GET() {
  if (!await getStaffUser()) return json({ error: 'Please sign in.' }, 401);
  try {
    const [ps, cs, ds] = await Promise.all([
      db().prepare('SELECT * FROM participants ORDER BY created_at DESC, name').all(),
      db().prepare('SELECT * FROM claims ORDER BY at DESC').all(),
      db().prepare('SELECT participant_id,channel,status,at,error FROM deliveries').all(),
    ]);
    return json({ participants: ps.results.map(p => ({ ...p, claims: cs.results.filter(c => c.participant_id === p.id), deliveries: ds.results.filter(d => d.participant_id === p.id) })), providers: settings() });
  } catch { return json({ error: 'Could not load shared event records. Please try again.' }, 503); }
}
export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return json({ error: 'Please sign in.' }, 401);
  if (!isSameOrigin(request,true)) return json({ error: 'Invalid request origin.' }, 403);
  if (Number(request.headers.get('content-length')) > 2_000_000) return json({ error: 'Request is too large.' }, 413);
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.type === 'import') {
      if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 1000) return json({ error: 'Import 1–1,000 participants at a time.' }, 400);
      const rows: ImportRow[] = []; const seen = new Set<string>();
      for (const [i, raw] of body.rows.entries()) {
        if (!raw || ['name','email','phone'].some(k => typeof raw[k] !== 'string') || (raw.team !== undefined && typeof raw.team !== 'string')) return json({ error: `Row ${i+2}: missing name, email or phone.` }, 400);
        const row = normalizeRow(raw); const error = validateRow(row);
        if (error) return json({ error: `Row ${i+2}: ${error}` }, 400);
        if (seen.has(row.email)) return json({ error: `Duplicate email in file: ${row.email}` }, 400);
        seen.add(row.email); rows.push(row);
      }
      const existing = await db().prepare('SELECT email FROM participants').all<{email: string}>();
      const emails = new Set(existing.results.map(p => p.email)); const at = Date.now();
      for (let offset = 0; offset < rows.length; offset += 50) {
        await db().batch(rows.slice(offset, offset+50).map(r => db().prepare('INSERT INTO participants (id,name,email,phone,team,token,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone,team=excluded.team').bind(crypto.randomUUID(), r.name, r.email, r.phone, r.team, crypto.randomUUID(), at)));
      }
      return json({ added: rows.filter(r => !emails.has(r.email)).length, updated: rows.filter(r => emails.has(r.email)).length });
    }
    if (body.type === 'claim') {
      const action = String(body.action); const token = String(body.token || '').replace(/^HACKPASS:/, '').trim();
      if (!actions.includes(action as typeof actions[number])) return json({ error: 'Unknown checkpoint.' }, 400);
      const p = await db().prepare('SELECT id FROM participants WHERE token=?').bind(token).first<{id:string}>();
      if (!p) return json({ error: 'QR not recognised. Check this participant’s registration.' }, 404);
      const result = await db().prepare(`INSERT INTO claims (participant_id,action,at,actor) SELECT ?,?,?,? WHERE ?='attendance' OR EXISTS(SELECT 1 FROM claims WHERE participant_id=? AND action='attendance') ON CONFLICT(participant_id,action) DO NOTHING`).bind(p.id, action, Date.now(), user.email, action, p.id).run();
      if (!result.meta.changes) {
        const previous = await db().prepare('SELECT at,actor FROM claims WHERE participant_id=? AND action=?').bind(p.id, action).first();
        return json(previous ? { error: 'Already recorded', previous } : { error: 'Check in the participant before recording lunch or goodies.' }, 409);
      }
      return json({ ok: true });
    }
    if (body.type === 'send') {
      const channel = String(body.channel); const config = settings();
      if (!['email','whatsapp'].includes(channel)) return json({ error: 'Unknown channel.' }, 400);
      if (!config[channel as keyof typeof config]) return json({ error: `Connect the ${channel === 'email' ? 'email sender' : 'WhatsApp Business sender and approved image template'} before sending.` }, 422);
      const p = await db().prepare('SELECT * FROM participants WHERE id=?').bind(String(body.id)).first<{id:string;name:string;email:string;phone:string;token:string}>();
      if (!p) return json({ error: 'Participant not found.' }, 404);
      const png = String(body.png || '');
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) || png.length > 300000) return json({ error: 'A valid QR image is required.' }, 400);
      const reserve = await db().prepare("INSERT INTO deliveries (participant_id,channel,status,at) VALUES (?,?,'sending',?) ON CONFLICT(participant_id,channel) DO UPDATE SET status='sending',at=excluded.at,error=NULL WHERE deliveries.status='failed'").bind(p.id, channel, Date.now()).run();
      if (!reserve.meta.changes) return json({ error: 'Already submitted or awaiting confirmation. Check delivery status before retrying.' }, 409);
      const e = process.env; let externalStarted = false;
      try {
        let providerId = '';
        if (channel === 'email') {
          externalStarted = true;
          const response = await fetch('https://api.resend.com/emails', { method:'POST', headers: { Authorization:`Bearer ${e.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':`qr-${p.id}` }, body:JSON.stringify({ from:e.EMAIL_FROM,to:[p.email],subject:'Your hackathon QR pass',text:`Hi ${p.name},\n\nYour unique hackathon QR is attached. Save it to your phone and show it at check-in, lunch and goodies collection. Use the same pass at every checkpoint.\n\nPlease keep your QR private.`,attachments:[{filename:'hackathon-pass.png',content:png.split(',')[1]}] }) });
          if (!response.ok) { externalStarted = false; throw new Error('Email provider rejected the request. Check sender configuration.'); }
          const result = await response.json() as {id:string}; providerId = result.id;
        } else {
          const graph = `https://graph.facebook.com/${e.WHATSAPP_GRAPH_VERSION}`;
          const bytes = Uint8Array.from(atob(png.split(',')[1]), c => c.charCodeAt(0));
          const form = new FormData(); form.set('messaging_product','whatsapp'); form.set('file',new Blob([bytes],{type:'image/png'}),'hackathon-pass.png');
          const upload = await fetch(`${graph}/${e.WHATSAPP_PHONE_NUMBER_ID}/media`,{method:'POST',headers:{Authorization:`Bearer ${e.WHATSAPP_ACCESS_TOKEN}`},body:form});
          if (!upload.ok) throw new Error('WhatsApp QR upload failed. Check sender configuration.');
          const media = await upload.json() as {id:string};
          externalStarted = true;
          const response = await fetch(`${graph}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${e.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:p.phone,type:'template',template:{name:e.WHATSAPP_TEMPLATE_NAME,language:{code:e.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'header',parameters:[{type:'image',image:{id:media.id}}]},{type:'body',parameters:[{type:'text',text:p.name}]}]}})});
          if (!response.ok) { externalStarted = false; throw new Error('WhatsApp provider rejected the request. Check approved template and recipient consent.'); }
          const result = await response.json() as {messages:{id:string}[]}; providerId = result.messages[0].id;
        }
        await db().prepare("UPDATE deliveries SET status='accepted',provider_id=?,error=NULL,at=? WHERE participant_id=? AND channel=?").bind(providerId, Date.now(), p.id, channel).run();
        return json({ ok:true, status:'accepted' });
      } catch (error) {
        const message = externalStarted ? 'Submission outcome unknown. Check the provider before retrying.' : (error instanceof Error ? error.message : 'Provider request failed.');
        await db().prepare('UPDATE deliveries SET status=?,error=?,at=? WHERE participant_id=? AND channel=?').bind(externalStarted?'unknown':'failed', message, Date.now(),p.id,channel).run();
        return json({error:message},502);
      }
    }
    return json({ error: 'Unknown operation.' }, 400);
  } catch { return json({ error: 'Could not save this operation. Refresh and check the current status before retrying.' }, 500); }
}

