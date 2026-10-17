import Desk from './desk';
import { requireStaffUser } from '@/lib/staff-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireStaffUser();
  return <Desk operator={user.displayName} />;
}
