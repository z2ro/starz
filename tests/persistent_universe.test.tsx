import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionGate } from '../frontend/src/universe/SessionGate';
import { apiRequest } from '../frontend/src/api/client';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('protects mutations with an explicit CSRF header without changing GET callers',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetcher);
 await apiRequest('/api/universe/mission',{method:'POST',body:'{}'});
 expect(fetcher.mock.calls[0][1].headers['x-starz-request']).toBe('1');
 expect(fetcher.mock.calls[0][1].headers['content-type']).toBe('application/json');
 await apiRequest('/api/state');expect(fetcher.mock.calls[1][1]).toBeUndefined();
});
it('shows independent account registration instead of gameplay after a 401',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:url==='/api/config',json:async()=>url==='/api/config'?{persistent:true}:{detail:'Entre na sua conta'}})));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><SessionGate><p>PRIVATE EMPIRE</p></SessionGate></QueryClientProvider>);
 await screen.findByRole('button',{name:'Entrar',exact:true});expect(screen.queryByText('PRIVATE EMPIRE')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Criar uma conta independente'}));
 expect(screen.getByRole('button',{name:'Criar conta e império'})).toBeTruthy();
 expect(screen.getByLabelText('Senha (mínimo 12 caracteres)')).toHaveAttribute('minlength','12');
 client.clear();
});
it('preserves the optional legacy scenario when persistent mode is disabled',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({persistent:false})})));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><SessionGate><p>LEGACY APP</p></SessionGate></QueryClientProvider>);
 await screen.findByText('LEGACY APP');client.clear();
});
