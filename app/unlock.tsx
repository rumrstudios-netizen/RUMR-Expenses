'use client';
import Brand from './brand';
import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import {browserClient} from '@/lib/supabase/browser';
import {forgetDevice,hasDevice,rememberDevice,unlockDevice} from '@/lib/auth/device';
export default function Unlock({onUnlocked}:{onUnlocked:()=>void}){
 const [mode,setMode]=useState<'loading'|'login'|'setup'|'unlock'>('loading');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[pin,setPin]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<Session|null>(null);
 useEffect(()=>{try{setMode(hasDevice()?'unlock':'login')}catch{setMode('login');setError('Allow browser storage to remember this device.')}},[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   if(mode==='login'){
    const {data,error}=await browserClient().auth.signInWithPassword({email,password});
    if(error||!data.session)throw error||Error('Unable to sign in.');
    const {data:member,error:denied}=await browserClient().from('allowed_members').select('email').eq('email',data.user.email?.toLowerCase()||'').maybeSingle();
    if(denied||!member){await browserClient().auth.signOut({scope:'local'});throw Error('This account does not have access to this workspace.')}
    setPending(data.session);setPassword('');setMode('setup');
   }else if(mode==='setup'){
    if(pin!==confirm)throw Error('The PINs do not match.');
    if(!pending)throw Error('Sign in again to set up this device.');
    await rememberDevice(pin,pending);setPin('');setConfirm('');setPending(null);onUnlocked();
   }else if(mode==='unlock'){
    await unlockDevice(pin);setPin('');onUnlocked();
   }
  }catch(e){setError(e instanceof Error?e.message:'Unable to unlock. Try again.')}finally{setBusy(false)}
 }
 function reset(){try{forgetDevice();setMode('login');setPin('');setConfirm('');setPending(null);setError('')}catch{setError('Allow browser storage, then try again.')}}
 return <main className="login-page">
  <section className="login-story"><Brand/><div><div className="eyebrow">LESS ADMIN. MORE ACTION.</div><h1>Great shoots.<br/><span>Clear numbers.</span></h1><p>Your projects, expenses, and receipts. One quiet place to keep production moving.</p></div><small>THE WORKSPACE BEHIND THE WORK.</small></section>
  <section className="login-form-wrap"><form className="login-form" onSubmit={submit} aria-busy={busy}>
   <div className="eyebrow">RUMR STUDIOS</div><h2>{mode==='unlock'?'Unlock your workspace.':mode==='setup'?'Make this device yours.':mode==='loading'?'Opening workspace…':'Welcome back.'}</h2>
   <p>{mode==='unlock'?'Enter your device PIN to pick up where you left off.':mode==='setup'?'Choose a 6–12 digit PIN. Next time, this is all you’ll need on this browser.':'Sign in once, then use a device PIN on returning visits.'}</p>
   {mode==='login'&&<><label>Email address<input required type="email" autoComplete="username" placeholder="you@studio.com" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><label>Password<input required type="password" autoComplete="current-password" placeholder="Enter your account password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label></>}
   {(mode==='setup'||mode==='unlock')&&<label>{mode==='setup'?'New device PIN':'Device PIN'}<input key={mode} autoFocus required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="off" placeholder="6–12 digits" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} disabled={busy}/></label>}
   {mode==='setup'&&<label>Confirm PIN<input required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,''))} disabled={busy}/></label>}
   {error&&<div className="error" role="alert">{error}</div>}
   {mode!=='loading'&&<button className="btn primary" disabled={busy}>{busy?'Please wait…':mode==='unlock'?'Unlock':mode==='setup'?'Save PIN & open workspace':'Continue'}{mode==='unlock'?<LockKeyhole size={17}/>:<ArrowRight size={17}/>}</button>}
   {mode==='unlock'&&<button type="button" className="btn" disabled={busy} onClick={reset}>Forgot PIN / use another account</button>}
   {mode==='setup'&&<button type="button" className="btn" disabled={busy} onClick={reset}>Back to sign in</button>}
   <p className="login-note">{mode==='setup'?'Use this on a device you trust. Your saved sign-in is encrypted with this PIN. Clearing browser data removes device setup.':mode==='unlock'?'Your account password is only needed if you forget your PIN or your saved sign-in expires.':'Private access for approved Rumr Studios accounts. For a password reset, contact your workspace owner.'}</p>
  </form></section>
 </main>
}
