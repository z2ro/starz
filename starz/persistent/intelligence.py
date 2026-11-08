"""Private, expiring observations: never re-read an enemy to refresh a report."""
from collections import Counter
from uuid import uuid4
from ..progression import effect, level
from .combat import local_defenders, fleet_units
from .combat_rules import ew_contest


def gather_intelligence(attacker, defender, ships, mission, *, stellar_units=(), observation=None):
    c,a,b=attacker.catalog,attacker.state,defender.state
    location=observation['planet_id'] if observation else b.planet_id
    strength=(1+effect(c,a,'espionage'))*(1+effect(c,a,'sensors'))*(1+min(1,sum(c.get('ships',s['hull_id']).science_bonus for s in ships)*.5))
    if mission=='RECON':strength*=.75
    protection=1+effect(c,b,'counter_intelligence')+.25*effect(c,b,'sensors')
    ratio=strength/protection
    quality=3 if ratio>=2 else 2 if ratio>=1.3 else 1 if ratio>=.7 else 0
    # EW contests only this observation; counter-intelligence already affected ratio.
    jammed=ew_contest(defender,fleet_units(defender,local_defenders(defender,location)),attacker)
    if jammed:quality=max(0,quality-1)
    detected=ratio<1.5
    def field(values,required):
        if quality<required:return {'status':'UNKNOWN','value':None}
        if quality>=required+1:return {'status':'CONFIRMED','value':values}
        return {'status':'ESTIMATED','value':{k:{'min':max(0,int(v*.5)), 'max':int(v*1.5)+1} for k,v in values.items()}}
    report={'id':str(uuid4()),'at':a.last_updated,'expires_at':a.last_updated+300+quality*300,
        'interference':jammed,'mission':mission,'planet_id':b.planet_id,'planet_name':defender.system().planet.name,
        'coordinates':[b.system_x,b.system_y,b.planet_index],'quality':quality,'detected':detected,
        'ships':field(dict(Counter(s['hull_id'] for s in local_defenders(defender,b.planet_id))),1),
        'defenses':field(dict(Counter(u['type'] for u in b.defenses['units'])),1),
        'stocks':field({r:round(n,1) for r,n in b.stocks.items()},2),
        'ammunition':field(b.defenses['ammunition'].copy(),2),
        'infrastructure':field(b.districts.copy(),3),
        'technology':field({k:level(b,k) for k in ['weapons','armor','shields','counter_intelligence']},3)}
    report['stellar_units']={'status':'CONFIRMED','value':{
        str(unit.id):{'state':unit.state,'hp':unit.payload.get('hp',0),'shield':unit.payload.get('shield',0),'subsystems':dict(unit.payload.get('subsystems',{}))}
        for unit in stellar_units}} if quality==3 else {'status':'UNKNOWN','value':None}
    if observation:
        report.update(observation,scope='stellar')
        for key in ('ships','defenses','stocks','ammunition','infrastructure','technology'):
            report[key]={'status':'UNKNOWN','value':None}
    # Countermeasures disrupt weak probes; damage is real and persists after return.
    report['probe_damage']={}
    if detected and quality==0 and mission=='ESPIONAGE':
        health=a.universe.setdefault('ship_health',{})
        for ship in ships:
            maximum=c.get('ships',ship['hull_id']).hull_points
            damage=max(0,min(health.get(ship['id'],maximum)-1,maximum*.2))
            health[ship['id']]=health.get(ship['id'],maximum)-damage
            report['probe_damage'][ship['id']]=damage
    a.universe['intelligence']=[report,*a.universe.get('intelligence',[])][:50]
    return report


def intel_view(state,now):
    return [{**r,'status':'OUTDATED' if now>=r['expires_at'] else 'CURRENT'} for r in state.universe.get('intelligence',[])]


def known_threat(state,target,now):
    report=next((r for r in intel_view(state,now) if r['planet_id']==target and r.get('scope')!='stellar'),None)
    if not report:return {'status':'UNKNOWN','message':'Sem reconhecimento: defesas e naves inimigas desconhecidas.'}
    return {'status':report['status'],'at':report['at'],'expires_at':report['expires_at'],'ships':report['ships'],'defenses':report['defenses'],'message':'Observação histórica; reforços podem ter chegado desde a coleta.'}
