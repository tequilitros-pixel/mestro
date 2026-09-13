"use client";
import {useEffect,useState} from 'react';
export default function PosSellServerSync({branchId}:{branchId:string}){
 const [status,setStatus]=useState('Servidor: verificando');
 useEffect(()=>{let stopped=false,running=false;const poll=async()=>{if(running)return;running=true;try{const r=await fetch('/api/pos2/outbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branchId})});if(!r.ok)throw Error();const s=await r.json();if(!stopped)setStatus(s.failed?'Servidor: error de sincronización':s.pending||s.processing?'Servidor: eventos pendientes':'Servidor sincronizado');}catch{if(!stopped)setStatus('Servidor: sincronización por verificar');}finally{running=false}};void poll();const timer=setInterval(poll,30000);return()=>{stopped=true;clearInterval(timer)}},[branchId]);
 return <span role="status">{status}</span>;
}
