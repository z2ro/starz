import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {ContentPages} from '../frontend/src/pixel-command/ContentPages';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps every item reachable by measured pages and groups confirmation as one block',async()=>{
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(160);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({height:60,width:300,top:0,left:0,right:300,bottom:60,x:0,y:0,toJSON:()=>({})}));
 render(<ContentPages label="Test roster"><p>First</p><p>Second</p><section className="build-review"><p>Cost 20</p><button>Confirm</button></section></ContentPages>);
 await waitFor(()=>expect(screen.getByText('1 / 2')).toBeTruthy());
 expect(screen.getByText('First')).toBeVisible();expect(screen.getByText('Second')).toBeVisible();expect(screen.getByText('Confirm')).not.toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Revisar'}));
 expect(screen.getByText('Cost 20')).toBeVisible();expect(screen.getByText('Confirm')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Página anterior · Test roster'}));expect(screen.getByText('First')).toBeVisible();
});
it('preserves controlled fields while moving between pages',async()=>{
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(80);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({height:60,width:300,top:0,left:0,right:300,bottom:60,x:0,y:0,toJSON:()=>({})}));
 render(<ContentPages label="Draft"><label>Callsign<input defaultValue="Horizon"/></label><p>Review</p></ContentPages>);
 await waitFor(()=>expect(screen.getByText('1 / 2')).toBeTruthy());fireEvent.change(screen.getByLabelText('Callsign'),{target:{value:'Explorer'}});
 fireEvent.click(screen.getByRole('button',{name:'Próxima página · Draft'}));fireEvent.click(screen.getByRole('button',{name:'Página anterior · Draft'}));expect(screen.getByLabelText('Callsign')).toHaveValue('Explorer');
});
it('opens the page containing the selected roster item and follows an explicit new selection',async()=>{
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(80);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({height:60,width:300,top:0,left:0,right:300,bottom:60,x:0,y:0,toJSON:()=>({})}));
 const roster=(selected:string)=><ContentPages label="Models" resetKey={selected}>{['A','B','C'].map(id=><button key={id} aria-pressed={id===selected}>{id}</button>)}</ContentPages>;
 const view=render(roster('C'));await waitFor(()=>expect(screen.getByText('3 / 3')).toBeTruthy());expect(screen.getByRole('button',{name:'C'})).toBeVisible();
 view.rerender(roster('A'));await waitFor(()=>expect(screen.getByText('1 / 3')).toBeTruthy());expect(screen.getByRole('button',{name:'A'})).toBeVisible();
});
it('offers a dedicated fullscreen review when a decision cannot fit, without changing its action',async()=>{
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(40);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({height:100,width:300,top:0,left:0,right:300,bottom:100,x:0,y:0,toJSON:()=>({})}));
 const confirm=vi.fn();render(<ContentPages label="Upgrade"><section className="build-review"><p>Cost 20</p><button onClick={confirm}>Confirm upgrade</button></section></ContentPages>);
 await waitFor(()=>expect(screen.getByRole('button',{name:/Abrir upgrade em tela cheia/})).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:/Abrir upgrade em tela cheia/}));expect(screen.getByRole('dialog',{name:'Upgrade'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Confirm upgrade'}));expect(confirm).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Fechar'}));expect(screen.queryByRole('dialog')).toBeNull();
});
it('keeps an open review attached to its stable identity while another message is inserted',async()=>{
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(40);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({height:100,width:300,top:0,left:0,right:300,bottom:100,x:0,y:0,toJSON:()=>({})}));
 const confirm=vi.fn();const content=(cost:number,warning:boolean)=><ContentPages label="Stable review">{warning&&<p key="warning">Changed stocks</p>}<section key="review" className="build-review"><p>Cost {cost}</p><button onClick={()=>confirm(cost)}>Confirm current</button></section></ContentPages>;
 const view=render(content(20,false));await waitFor(()=>expect(screen.getByRole('button',{name:/Abrir stable review/})).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:/Abrir stable review/}));
 view.rerender(content(30,true));const dialog=screen.getByRole('dialog');expect(within(dialog).getByText('Cost 30')).toBeTruthy();fireEvent.click(within(dialog).getByRole('button',{name:'Confirm current'}));expect(confirm).toHaveBeenCalledWith(30);
});
