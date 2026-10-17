import { clearSession } from '@/lib/staff-auth';
import { isSameOrigin } from '@/lib/request';
export async function POST(request:Request) {
  if(!isSameOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});
  await clearSession();return Response.json({ok:true});
}
