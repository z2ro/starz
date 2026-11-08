"""Deterministic experimental samples on the authoritative resolver; no database access."""
import argparse
import json
from pathlib import Path
import sys
from uuid import UUID

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'tests')]
from test_combat3 import engine,ship,defense
from starz.data import Catalog
from starz.db import models as m
from starz.db.store import utc
from starz.persistent.combat import resolve_battle
from starz.persistent.combat_rules import EXPERIMENTS,STELLAR_RULES,SUBSYSTEMS,interdiction_delay
from starz.persistent.stargrave import combat_units

CATALOG=Catalog.load(ROOT/'game_data',ROOT/'persistent_data')
COMPOSITIONS={
    'B02':([('scout_hull',10)],[('vanguard_hull',3)]),
    'B03':([('vanguard_hull',6)],[('aegis_hull',2)]),
    'B04':([('sentinel_hull',4)],[('leviathan_hull',1)]),
    'B05':([('vanguard_hull',3),('odyssey_hull',1)],[('sentinel_hull',2),('odyssey_hull',1)]),
    'B13':([('sentinel_hull',4)],[('aegis_hull',2)]),
    'B15':([('leviathan_hull',48)],[]),
    'B16':([('leviathan_hull',48)],[]),
    'B17':([('leviathan_hull',48)],[('aegis_hull',3),('vanguard_hull',3)]),
}


def sample(case,experiment,doctrine,profile,escorts,reverse=False,shielded=True,capital_count=48):
    levels={'weapons':2,'armor':2,'shields':2,'fire_control_doctrine':1,'shield_disruption':1,
            'fleet_coordination':int(escorts),'electronic_warfare':1,'sensor_array':2,'computing':2}
    levels['containment_warfare']=int(case=='B16')
    a,b=engine(CATALOG,'a',levels),engine(CATALOG,'b',levels)
    left,right=COMPOSITIONS[case]
    if case in ('B15','B16','B17'):left=[('leviathan_hull',capital_count)]
    if reverse:left,right=right,left
    for target,composition,prefix in [(a,left,'a'),(b,right,'b')]:
        for hull,count in composition:
            for _ in range(count):ship(target,hull,prefix+str(len(target.state.ships)))
    if case=='B13' and shielded:defense(b,'planetary_shield','shield',350)
    if not shielded:
        # Actual per-ship shields are derived from catalog/technology; only this
        # target uses an unshielded structure to measure the profile's hull tradeoff.
        b.state.ships=[];defense(b,'point_defense','unshielded')
    stellar=[]
    if case in ('B15','B16','B17'):
        row=m.StellarUnit(id=UUID(int=1),universe_id=UUID(int=2),source_id=UUID(int=3),
            project_id=UUID(int=4),empire_id=UUID(int=5),system_id=UUID(int=6),planet_id=None,
            state='operational',created_at=utc(1000),stocks={},payload={
                'hp':STELLAR_RULES['structural_hp'],'shield':STELLAR_RULES['shield_capacity'],
                'subsystems':dict.fromkeys(SUBSYSTEMS,STELLAR_RULES['subsystem_hp']),
                'energy':STELLAR_RULES['energy_capacity'],'energy_at':1000})
        stellar=combat_units([row],b,1000,experiment)
    config={'doctrine':doctrine,'weapon_profile':profile,'experiment':experiment}
    if case=='B16':config.update(target_stellar_id=str(UUID(int=1)),target_subsystem='weapons')
    costs=[]
    for participant in (a,b):
        value={}
        definitions=[CATALOG.get('ships',unit['hull_id']) for unit in participant.state.ships]
        definitions += [CATALOG.get('defenses',unit['type']) for unit in participant.state.defenses['units']]
        for definition in definitions:
            for resource,amount in definition.cost.items():value[resource]=value.get(resource,0)+amount
        costs.append(value)
    report=resolve_battle(a,list(a.state.ships),b,'b',config=config,stellar_defenders=stellar)
    return {'case':case,'experiment':experiment,'doctrine':doctrine,'profile':profile,
        'escorts':escorts,'reverse':reverse,'shielded':shielded,'unit_catalog_cost_only':costs,'stellar_cost_excluded':bool(stellar),
        'capital_count':capital_count if case in ('B15','B16','B17') else None,'result':report['outcome'],'salvos':len(report['rounds']),
        'damage':{side:{kind:sum(r[side].get(kind,0) for r in report['rounds'])
                       for kind in ('hull_damage','shield_absorbed')} for side in ('attacker','defender')},
        'conventional_survivors':{'attacker':len(a.state.ships),'defender':len(b.state.ships)},
        'stellar_after':report.get('defender_stellar_after',[])}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
    rows=[]
    for case in COMPOSITIONS:
        for experiment in EXPERIMENTS:
            for doctrine in ('balanced','interception','rupture'):
                for profile in ('standard','anti_shield'):
                    for escorts in (False,True):
                        options={'reverse':False,'shielded':True}
                        row=sample(case,experiment,doctrine,profile,escorts,**options)
                        assert row==sample(case,experiment,doctrine,profile,escorts,**options),'Nondeterministic result'
                        assert row['salvos']<=6
                        rows.append(row)
    for experiment in EXPERIMENTS:
        for profile in ('standard','anti_shield'):
            rows.append(sample('B13',experiment,'balanced',profile,False,shielded=False))
        for case in ('B02','B03','B04'):
            rows.append(sample(case,experiment,'balanced','standard',False,reverse=True))
    for experiment in EXPERIMENTS:
        for count in (4,8,12,24):
            for profile in ('standard','anti_shield'):
                rows.append(sample('B15',experiment,'balanced',profile,False,capital_count=count))
    result={'experimental':True,'balanced':False,'scope':'CPU resolver samples, not persistence or win-rate proof',
        'replayed_samples':288,'samples':rows,'interdiction_seconds':{key:interdiction_delay(7200,key) for key in EXPERIMENTS},
        'limits':['Unit catalog costs exclude Stargrave construction, propulsion, fuel, science, infrastructure and replacement time.',
                  'B16 exercises resolver aiming; authorization is tested separately.',
                  'B01/B06–B12/B14/B18 require the focused behavioral and PostgreSQL tests, not these samples.']}
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'samples':len(rows),'deterministic':True,'balanced':False,'output':str(output)}))


if __name__=='__main__':main()
