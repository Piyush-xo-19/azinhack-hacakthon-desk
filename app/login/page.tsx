import { authConfigured, getStaffUser } from '@/lib/staff-auth';
import { redirect } from 'next/navigation';
import LoginForm from './form';
export const dynamic='force-dynamic';
export default async function Login(){if(await getStaffUser())redirect('/');return <main className="login-page"><section className="panel login-card"><p className="eyebrow">AZINHACK · EVENT OPERATIONS</p><h1>Welcome to the desk.</h1><p className="subtitle">Sign in to manage check-in, lunch and goodies.</p>{authConfigured()?<LoginForm/>:<div className="alert">Organizer setup is pending. The event organizer needs to connect the database and configure staff accounts before sign-in opens.</div>}</section></main>;}
