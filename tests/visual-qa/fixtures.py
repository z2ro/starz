"""Staged UI review data; no database, account, lifespan or network is started."""
import json
import os
os.environ['STARZ_PERSISTENT'] = '1'
from starz.api import catalog, state_snapshot, galaxy_snapshot
from starz.simulation import Engine
from starz.progression import research_quote, building_quote
from starz.persistent.combat import local_defenders
from starz.defenses import defense_quote, build_defense

NOW = 1800000000
PLANET = '00000000-0000-4000-8000-000000000001'
EMPIRE = '00000000-0000-4000-8000-000000000002'

def fixture(populated):
    e=Engine.new(catalog,seed='STARZ-DESIGN-QA',now=NOW);s=e.state
    s.planet_id=s.home_planet_id=PLANET;s.home_system_x=s.system_x;s.home_system_y=s.system_y
    s.planets=[{'id':PLANET,'name':e.system().planet.name,'x':s.system_x,'y':s.system_y,'planet_index':s.planet_index,'population_total':500 if populated else 100,'home':True}]
    s.population_total=s.planets[0]['population_total']
    s.universe={'mode':'persistent','levels':{'orbital_engineering':1},'reports':[]}
    s.districts={'civil_district':2,'solar_field':5,'ore_extractor':1,'processor':1,'research_lab':1,'orbital_shipyard':1}
    s.stocks={'raw_ore':500,'volatiles':300,'refined_alloy':400,'components':180,'ion_fuel':400,'fusion_fuel':100}
    if populated:
        s.districts.update(solar_field=30,processor=3,research_lab=5,civil_lab=5,military_lab=5,fundamental_lab=5,manufacturing=3)
        s.universe['levels']={t.id:(1 if t.kind=='breakthrough' else 2) for t in catalog.items['technologies'].values()}
        s.stocks={k:50000 for k in s.stocks}
    s.research['completed']=list(s.universe['levels']);s.research['completed_at']={k:NOW for k in s.research['completed']}
    s.system_knowledge={f'{s.system_x}:{s.system_y}':NOW};e.advance(NOW)
    if populated:
        for i,hull in enumerate(['scout_hull']*4+['wayfarer_hull']*2+['vanguard_hull','atlas_hull']):
            h=catalog.get('ships',hull);propulsion=catalog.get('propulsion',h.compatible_propulsion[0])
            s.ships.append({'id':f'10000000-0000-4000-8000-{i:012d}','hull_id':hull,'propulsion_id':propulsion.id,'fuel_id':propulsion.compatible_fuels[0],'crew':h.crew,'mass':h.mass,'ready_at':NOW-60,'origin_planet_id':PLANET,'system_x':s.system_x,'system_y':s.system_y})
        for i,key in enumerate(['point_defense','planetary_shield','orbital_platform']):
            item=catalog.get('defenses',key);s.defenses['units'].append({'id':f'20000000-0000-4000-8000-{i:012d}','type':key,'hp':item.hull_points,'charge':item.shield})
        s.defenses['ammunition']={'anti_ship_missile':12,'interceptor_missile':8,'strategic_missile':4}
        e.build('ore_extractor',now=NOW);build_defense(e,'point_defense',2)
        for key in ['extraction','weapons','computing']:e.research(key,now=NOW)
    s.stocks_by_planet={PLANET:s.stocks}
    state=state_snapshot(e)
    player={'id':EMPIRE,'name':'VISUAL QA · STAGED DATA','self':True,'planets':[{'id':PLANET,'x':s.system_x,'y':s.system_y,'index':s.planet_index,'home':True}],'relation':{'status':'neutral','proposal':None}}
    universe={'empire_id':EMPIRE,'name':player['name'],'players':[player],'research':[research_quote(catalog,s,k) for k in catalog.items['technologies']],'buildings':[building_quote(catalog,s,k) for k in catalog.items['districts']],'reports':[],'battles':[],'intelligence':[],'market':[],'missions':[],'fleet_limit':2,'colony_limit':1,'defenses':{'ships':[{'id':ship['id'],'hull_id':ship['hull_id'],'hp':catalog.get('ships',ship['hull_id']).hull_points} for ship in local_defenders(e,PLANET)],'inventory':s.defenses,'options':[defense_quote(e,k) for k in catalog.items['defenses']],'repairs':[],'operational':min(e.capacities()['energy_coverage'],e.capacities()['workforce_coverage']),'battles':[],'strikes':[]}}
    return {'state':state,'universe':universe,'galaxy':galaxy_snapshot(e,(s.system_x,s.system_y),2)}

if __name__=='__main__':
    kinds=('resources','districts','technologies','ships','propulsion','fuels','travel_modes','defenses')
    print(json.dumps({'catalog':{k:[v.model_dump() for _,v in sorted(catalog.items[k].items())] for k in kinds},'empty':fixture(False),'populated':fixture(True),'now':NOW}))
