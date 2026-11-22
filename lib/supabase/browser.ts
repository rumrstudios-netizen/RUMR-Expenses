import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let client: SupabaseClient | undefined;
export function browserClient(){
 if (!client) client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return client;
}
