export type Action = 'attendance' | 'lunch' | 'goodies';
export type Claim = { action: Action; at: number; actor: string };
export type Delivery = { channel: string; status: string; at: number; error?: string };
export type Participant = { id: string; name: string; email: string; phone: string; team: string; token: string; created_at: number; claims: Claim[]; deliveries: Delivery[] };
export type ImportRow = { name: string; email: string; phone: string; team: string };
export const actions: Action[] = ['attendance', 'lunch', 'goodies'];
export function normalizeRow(row: ImportRow): ImportRow {
  return { name: row.name.trim(), email: row.email.trim().toLowerCase(), phone: row.phone.replace(/[\s()+.-]/g, ''), team: (row.team || '').trim() };
}
export function validateRow(row: ImportRow): string | null {
  if (!row.name || row.name.length > 150) return 'Name is required (maximum 150 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || row.email.length > 254) return 'Enter a valid email.';
  if (!/^[1-9]\d{7,14}$/.test(row.phone)) return 'Use a phone number with country code, e.g. 919876543210.';
  if (row.team.length > 150) return 'Team name is too long.';
  return null;
}
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  const source = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length) throw new Error('Unexpected quote in CSV.');
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(field); if (row.some(x => x.trim())) rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quote in CSV.');
  row.push(field); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
