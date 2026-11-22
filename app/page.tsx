import Ledger from './ledger';
import {requireOwner} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home(){try{await requireOwner()}catch{redirect('/login')}return <Ledger/>}
