'use client';
import {useEffect,useState} from 'react';
import Login from './unlock';
import Ledger from './ledger';
export default function Workspace(){
 const [unlocked,setUnlocked]=useState(false);
 useEffect(()=>{
  const leave=()=>{document.documentElement.style.visibility='hidden'};
  const restore=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload()};
  const changed=(event:StorageEvent)=>{if(event.key==='rumr.device.v1'&&!event.newValue)window.location.reload()};
  window.addEventListener('pagehide',leave);window.addEventListener('pageshow',restore);window.addEventListener('storage',changed);
  return()=>{window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',restore);window.removeEventListener('storage',changed)};
 },[]);
 return unlocked?<Ledger/>:<Login onUnlocked={()=>setUnlocked(true)}/>;
}
