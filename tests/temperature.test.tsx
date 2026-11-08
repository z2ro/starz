import {expect,it} from 'vitest';
import {formatTemperatureKelvin} from '../frontend/src/app/format';
it.each([[299,'26 °C'],[321,'48 °C'],[325,'52 °C'],[250,'-23 °C'],[0,'-273 °C'],[273,'0 °C'],[273.15,'0 °C'],[272.65,'-1 °C']])('formats %s Kelvin once at the UI boundary', (kelvin,expected)=>expect(formatTemperatureKelvin(kelvin)).toBe(expected));
it.each([null,undefined,NaN,Infinity,-1,'26 °C'])('does not invent a temperature for %s',value=>expect(formatTemperatureKelvin(value)).toBe('Não informado'));

import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PlanetaryStatus} from '../frontend/src/pixel-command/master/PlanetaryStatus';
import {planetSnapshot} from './fixtures/planetIntegration';
it('shows Celsius in the Overview physical status without changing the Kelvin snapshot',()=>{
 const state=planetSnapshot();state.system.planet.temperature=299;
 render(<MemoryRouter><PlanetaryStatus state={state}/></MemoryRouter>);
 expect(screen.getByText('26 °C')).toBeTruthy();expect(state.system.planet.temperature).toBe(299);cleanup();
});
