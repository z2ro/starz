import { useState, type ReactNode, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import './universe.css';
export function SessionGate({children}:{children:ReactNode}) {
 const config=useQuery({queryKey:['config'],queryFn:()=>apiRequest<{persistent:boolean}>('/api/config'),retry:false,staleTime:Infinity});
 const me=useQuery({queryKey:['account'],queryFn:()=>apiRequest<{username:string}>('/api/auth/me'),enabled:config.data?.persistent===true,retry:false,refetchInterval:30000});
 if(config.isPending || (config.data?.persistent && me.isPending))return <div className="boot">Conectando ao universo…</div>;
 if(config.error)return <div className="fatal">Servidor indisponível. <button onClick={()=>void config.refetch()}>Reconectar</button></div>;
 if(config.data?.persistent && me.error)return <Login />;
 return <>{children}</>;
}
function Login(){
 const [register,setRegister]=useState(false),[username,setName]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await apiRequest(`/api/auth/${register?'register':'login'}`,{method:'POST',body:JSON.stringify({username,password})});window.location.hash='/universe';window.location.reload();}catch(e){setError((e as Error).message);setBusy(false);}}
 return <main className="universe-login"><form onSubmit={e=>void submit(e)}><span className="eyebrow">PERSISTENT UNIVERSE</span><h1>STARZ</h1><p>Uma civilização sua. Um universo compartilhado.</p><p>Indústria, pesquisa e viagens continuam enquanto você está offline. Sem turnos, prazo final ou vitória obrigatória.</p><h2>{register?'Fundar um império':'Acessar seu império'}</h2><label>Comandante<input autoComplete="username" value={username} onChange={e=>setName(e.target.value)} pattern="[a-zA-Z][a-zA-Z0-9_]{2,23}" required minLength={3} maxLength={24}/></label><label>Senha (mínimo 12 caracteres)<input type="password" autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} required/></label>{error&&<p role="alert">{error}</p>}<button className="button" disabled={busy}>{busy?'Conectando…':register?'Criar conta e império':'Entrar'}</button><button className="button button-ghost" type="button" onClick={()=>setRegister(!register)}>{register?'Já tenho conta':'Criar uma conta independente'}</button><small>Experimento local. Use outra janela anônima ou outro perfil do navegador para o segundo jogador.</small></form></main>;
}
