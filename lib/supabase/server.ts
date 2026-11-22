import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {headers} from 'next/headers';
export class WorkspaceAuthError extends Error {constructor(message:string,public status:number){super(message)}}
export function errorStatus(error:unknown,fallback:number){return error instanceof WorkspaceAuthError?error.status:fallback}
export async function serverClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const authorization=(await headers()).get('authorization');
 if(!authorization?.match(/^Bearer \S+$/))throw new WorkspaceAuthError('Unlock your workspace first.',401);
 if(!url||!key)throw Error('Supabase connection has not been configured.');
 return createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function requireOwner(){
 const supabase=await serverClient();const token=(await headers()).get('authorization')!.slice(7);
 const {data,error}=await supabase.auth.getUser(token);
 if(error||!data.user)throw new WorkspaceAuthError('Please unlock your workspace.',401);
 const {data:member,error:denied}=await supabase.from('allowed_members').select('email').eq('email',data.user.email?.toLowerCase()||'').maybeSingle();
 if(denied||!member)throw new WorkspaceAuthError('This account does not have access to this workspace.',403);
 return {uid:data.user.id,supabase};
}
