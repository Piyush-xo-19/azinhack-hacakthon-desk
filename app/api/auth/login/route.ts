// Password login is retired. Legacy passwords and hash configuration cannot mint sessions.
export async function POST(){return Response.json({error:'Password sign-in has been removed. Continue with Google.'},{status:410,headers:{'Cache-Control':'no-store'}});}
