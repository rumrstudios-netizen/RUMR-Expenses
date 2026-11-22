'use client';
import {createClient,type Session} from '@supabase/supabase-js';
import {browserClient} from '@/lib/supabase/browser';
import {VAULT_KEY,createVault,openVault,seal} from './vault.mjs';
let key:CryptoKey|null=null;
let session:Session|null=null;
let salt='';
function readVault(){const value=localStorage.getItem(VAULT_KEY);return value?JSON.parse(value):null}
export function hasDevice(){return !!localStorage.getItem(VAULT_KEY)}
export function forgetDevice(){key=null;session=null;salt='';localStorage.removeItem(VAULT_KEY)}
async function saveSession(next:Session){
 if(!key)throw Error('Unlock this device first.');
 localStorage.setItem(VAULT_KEY,JSON.stringify(await seal(next,key,salt)));
 session=next;
}
async function exclusive<T>(fn:()=>Promise<T>){return navigator.locks?navigator.locks.request('rumr-device-session',fn):fn()}
export async function rememberDevice(pin:string,next:Session){
 const result=await createVault(pin,next);
 localStorage.setItem(VAULT_KEY,JSON.stringify(result.vault));
 key=result.key;salt=result.vault.salt;session=next;
}
export async function unlockDevice(pin:string){
 return exclusive(async()=>{
  const vault=readVault();const opened=await openVault(pin,vault);
  const {data,error}=await browserClient().auth.setSession(opened.session);
  if(error||!data.session)throw Error('Your saved sign-in has expired. Use Forgot PIN to sign in again.');
  key=opened.key;salt=vault.salt;
  await saveSession(data.session);
 });
}
export async function authFetch(input:RequestInfo|URL,init:RequestInit={}){
 const token=await exclusive(async()=>{
  if(!session||!key)throw Error('Unlock this device first.');
  if((session.expires_at||0)*1000<Date.now()+120000){
   // Another tab may have rotated the refresh token. Read the latest encrypted copy.
   const vault=readVault();
   if(!vault)throw Error('This device was forgotten. Sign in again.');
   const bytes=Uint8Array.from(atob(vault.iv),(c:string)=>c.charCodeAt(0));
   const cipher=Uint8Array.from(atob(vault.ciphertext),(c:string)=>c.charCodeAt(0));
   const saved=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes},key,cipher)));
   // A fresh auth client avoids refreshing a stale in-memory session before
   // exchanging the latest token from the shared vault.
   const renewal=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{storageKey:'rumr-renewal',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   try{
    const {data,error}=await renewal.auth.refreshSession({refresh_token:saved.refresh_token});
    if(error||!data.session)throw Error('Your sign-in expired. Lock the app and sign in again.');
    await saveSession(data.session);
    const restored=await browserClient().auth.setSession(data.session);
    if(restored.error)throw restored.error;
   }finally{await renewal.auth.dispose()}
  }
  return session.access_token;
 });
 const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+token);
 return fetch(input,{...init,headers,cache:'no-store'});
}
export async function forgetAndSignOut(){
 forgetDevice();
 try{await browserClient().auth.signOut({scope:'local'})}finally{window.location.replace('/login')}
}
