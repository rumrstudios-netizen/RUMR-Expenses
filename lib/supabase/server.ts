import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function serverClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('Supabase connection has not been configured.');
 const jar=await cookies();
 return createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll:items=>{try{items.forEach(({name,value,options})=>jar.set(name,value,options))}catch{/* Server components use refreshed cookies from proxy. */}}}});
}
export class WorkspaceAuthError extends Error {constructor(message:string,public status:number){super(message)}}
export function errorStatus(error:unknown,fallback:number){return error instanceof WorkspaceAuthError?error.status:fallback}
export async function requireOwner(){const supabase=await serverClient();const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw new WorkspaceAuthError('Please sign in to your workspace.',401);const {data:member,error:denied}=await supabase.from('allowed_members').select('email').eq('email',data.user.email?.toLowerCase()||'').maybeSingle();if(denied||!member)throw new WorkspaceAuthError('This account does not have access to this workspace.',403);return {uid:data.user.id,supabase}}
