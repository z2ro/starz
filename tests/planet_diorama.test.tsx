import {describe,it,expect} from 'vitest';
import {dioramaBuildings} from '../frontend/src/universe/PlanetDiorama';

describe('planetary diorama',()=>{
  it('shows only constructed supported buildings and keeps positions through level updates',()=>{
    const first=dioramaBuildings('planet-a',{civil_district:1,ore_extractor:2,fuel_refinery:0,processor:7});
    expect(first.map(b=>b.id)).toEqual(['civil_district','ore_extractor']);
    const next=dioramaBuildings('planet-a',{civil_district:2,ore_extractor:2,fuel_refinery:1});
    expect(next.slice(0,2).map(b=>b.position)).toEqual(first.map(b=>b.position));
    expect(dioramaBuildings('planet-a',{civil_district:1})).toEqual(dioramaBuildings('planet-a',{civil_district:1}));
    expect(dioramaBuildings('planet-b',{})).toEqual([]);
    expect(new Set(next.map(b=>b.position.join(','))).size).toBe(3);
  });
});
