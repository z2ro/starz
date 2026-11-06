import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {IntelligenceReport,IntelligenceFieldView,type IntelligenceReportData} from '../frontend/src/universe/IntelligenceReport';
import {Tabs} from '../frontend/src/components/ui/Tabs';
import {ViewportWorkspace} from '../frontend/src/pixel-command/ViewportWorkspace';
import {MapViewport} from '../frontend/src/components/ui/MapViewport';
import catalog from './fixtures/fleet-api-catalog.json';
afterEach(cleanup);
it('never presents unknown defenses as zero and distinguishes stale estimates',()=>{
 const unknown={status:'UNKNOWN' as const,value:null};const report:IntelligenceReportData={id:'report',planet_id:'target',planet_name:'Target',coordinates:[1,2,0],at:1000,expires_at:1300,status:'OUTDATED',quality:1,detected:true,ships:unknown,defenses:{status:'ESTIMATED',value:{point_defense:{min:1,max:5}}},stocks:unknown,ammunition:unknown,infrastructure:unknown,technology:unknown};
 render(<IntelligenceReport report={report} catalog={catalog}/>);expect(screen.getByText(/DESATUALIZADO/)).toBeTruthy();fireEvent.click(screen.getByText(/DESATUALIZADO/));expect(screen.getAllByText(/Não observado/).length).toBe(5);expect(screen.getByText(/1–5/)).toBeTruthy();expect(screen.queryByText('Confirmado')).toBeNull();
});
it('offers keyboard navigation between explicit subviews',()=>{const change=vi.fn();render(<Tabs value="a" onChange={change} label="Etapas" items={[{id:'a',label:'Naves'},{id:'b',label:'Destino'}]}/>);fireEvent.keyDown(screen.getByRole('tab',{name:'Naves'}),{key:'ArrowRight'});expect(change).toHaveBeenCalledWith('b');expect(screen.getByRole('tab',{name:'Destino'})).toHaveFocus();});
it('preserves view content while navigating contextual inspector panels',()=>{render(<MemoryRouter initialEntries={['/research']}><ViewportWorkspace><p>Geografia preservada</p></ViewportWorkspace></MemoryRouter>);fireEvent.click(screen.getByRole('tab',{name:'Pesquisa e plano'}));expect(screen.getByText('Geografia preservada').parentElement).toHaveAttribute('data-panel','detail');});
it('zooms the existing map without replacing its contents',()=>{render(<MapViewport label="Mapa"><button>Sistema persistente</button></MapViewport>);const system=screen.getByRole('button',{name:'Sistema persistente'});fireEvent.click(screen.getByRole('button',{name:'Ampliar Mapa'}));expect(screen.getByRole('button',{name:'110%'})).toBeTruthy();expect(screen.getByRole('button',{name:'Sistema persistente'})).toBe(system);});
