// Next.js can canonicalize request.url to an internal hostname behind a proxy.
// Compare against the inbound Host, which browsers cannot override in fetch.
export function isSameOrigin(request:Request,allowMissing=false){
  const origin=request.headers.get('origin');if(!origin)return allowMissing;
  try{const parsed=new URL(origin);const host=request.headers.get('host')||new URL(request.url).host;const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);return parsed.host===host&&(parsed.protocol==='https:'||local&&parsed.protocol==='http:');}catch{return false;}
}
