import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {LivingColonyScene} from '../frontend/src/universe/LivingColonyScene';

describe('LivingColonyScene',()=>{
  it('shows only built installations and selects them by click or keyboard',()=>{
    const select=vi.fn();const {rerender}=render(<LivingColonyScene levels={{civil_district:2,ore_extractor:0,fuel_refinery:1}} onSelect={select}/>);
    expect(screen.queryByRole('button',{name:/Extrator/})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:/Distrito civil, nível 2/}));expect(select).toHaveBeenCalledWith('civil_district');
    const refinery=screen.getByRole('button',{name:/Refinaria de combustível, nível 1/});refinery.focus();expect(document.activeElement).toBe(refinery);fireEvent.click(refinery);expect(select).toHaveBeenCalledWith('fuel_refinery');
    rerender(<LivingColonyScene levels={{ore_extractor:3}} onSelect={select}/>);
    expect(screen.queryByRole('button',{name:/Distrito civil/})).toBeNull();expect(screen.getByRole('button',{name:/Extrator de ferrita, nível 3/})).toBeTruthy();
  });
});
