"""Planet-owned structures and paid manufacturing queues; no fleet entities."""
from copy import deepcopy
from math import ceil, isfinite
from uuid import uuid4, uuid5, NAMESPACE_URL
from .data import DataValidationError
from .effects import require_available
from .progression import effect, level


def ensure_defenses(catalog, state):
    if state.universe is None:return
    for key, value in {'units':[], 'queue':[], 'ammunition':{}}.items():state.defenses.setdefault(key,deepcopy(value))
    old=state.districts.get('orbital_battery',0)
    for index in range(old):
        id=str(uuid5(NAMESPACE_URL,f'starz-defense:{state.planet_id}:{index}'))
        if not any(u['id']==id for u in state.defenses['units']):state.defenses['units'].append({'id':id,'type':'point_defense','hp':catalog.get('defenses','point_defense').hull_points,'charge':0})
    if old:state.districts['orbital_battery']=0


def complete_defenses(catalog,state,now):
    if state.universe is None:return
    for job in state.defenses.get('queue',[]):
        if job['complete_at']>now:continue
        item=catalog.get('defenses',job['type'])
        if job.get('repair'):
            unit=next((u for u in state.defenses['units'] if u['id']==job['repair']),None)
            if unit:unit['hp']=item.hull_points
            else:
                state.notices.insert(0,'Reparo encerrado: estrutura destruída durante a obra.')
                continue
        elif item.kind=='ammunition':state.defenses['ammunition'][item.id]=state.defenses['ammunition'].get(item.id,0)+job['count']
        else:
            for id in job['unit_ids']:
                if not any(u['id']==id for u in state.defenses['units']):state.defenses['units'].append({'id':id,'type':item.id,'hp':item.hull_points,'charge':0})
        state.notices.insert(0,f'Defesa concluída: {item.name} × {job["count"]}.')
    state.defenses['queue']=[j for j in state.defenses.get('queue',[]) if j['complete_at']>now]


def regenerate_shields(catalog,state,seconds,factor):
    if state.universe is None:return
    for u in state.defenses.get('units',[]):
        cap=catalog.get('defenses',u['type']).shield*(1+effect(catalog,state,'shields'))
        u['charge']=min(cap,u.get('charge',0)+seconds*factor*catalog.get('defenses',u['type']).shield_regen) if cap else 0


def defense_quote(engine,id,count=1,repair=None):
    ensure_defenses(engine.catalog,engine.state)
    c,s=engine.catalog,engine.state;item=c.get('defenses',id);requirements=[];factor=1
    if not 1<=count<=50:raise DataValidationError('Quantidade deve estar entre 1 e 50.')
    if repair:
        unit=next((u for u in s.defenses['units'] if u['id']==repair and u['type']==id),None)
        if not unit:raise DataValidationError('Defesa não pertence ao planeta selecionado.')
        factor=max(0,1-unit['hp']/item.hull_points)*.5
        if factor==0:requirements.append('Estrutura sem dano.')
        if any(j.get('repair')==repair for j in s.defenses['queue']):requirements.append('Reparo já em andamento.')
        count=1
    else:
        try:require_available(c,s,item)
        except DataValidationError as exc:requirements.append(str(exc))
        for ref,needed in item.level_requires.items():
            if level(s,ref)<needed:requirements.append(f'{c.get("technologies",ref).name}: nível {needed}')
    capacities=engine.capacities()
    industrial=capacities['industrial_capacity']*min(capacities['energy_coverage'],capacities['workforce_coverage'])
    if industrial<item.industrial_requirement:requirements.append(f'Capacidade industrial efetiva: {industrial:g}/{item.industrial_requirement}.')
    if capacities['construction_slots_available']<1:requirements.append('Todas as equipes de construção estão ocupadas.')
    if not repair and item.kind=='structure':
        pending=[(c.get('defenses',j['type']),j['count']) for j in s.defenses['queue'] if not j.get('repair')]
        energy=(item.energy_consumption*count+sum(d.energy_consumption*n for d,n in pending))/(1+effect(c,s,'energy_efficiency'))
        workers=(item.workforce*count+sum(d.workforce*n for d,n in pending))/(1+effect(c,s,'workforce'))
        if capacities['energy_generation']-capacities['energy_consumption']<energy:requirements.append('Amplie a geração de energia antes de instalar esta quantidade.')
        if capacities['available_population']<workers:requirements.append('Trabalhadores livres insuficientes para a instalação e as filas.')
        if len(s.defenses['units'])+sum(j['count'] for j in s.defenses['queue'] if c.get('defenses',j['type']).kind=='structure' and not j.get('repair'))+count>1000:requirements.append('Limite operacional: 1000 estruturas por planeta.')
    if item.kind=='ammunition' and s.defenses['ammunition'].get(id,0)+sum(j['count'] for j in s.defenses['queue'] if j['type']==id)+count>10000:requirements.append('Depósito de munição cheio (10000 por tipo).')
    return {'id':id,'count':count,'unit_cost':{r:v*factor for r,v in item.cost.items()},'work_rate':1+effect(c,s,'build_speed'),'cost':{r:ceil(v*count*factor) for r,v in item.cost.items()},'duration':max(1,ceil(item.duration*count*factor/(1+effect(c,s,'build_speed')))),'requirements':requirements}


def build_defense(engine,id,count=1,repair=None):
    q=defense_quote(engine,id,count,repair)
    if q['requirements']:raise DataValidationError('; '.join(q['requirements']))
    engine._pay(q['cost']);now=engine.state.last_updated
    job={'id':str(uuid4()),'type':id,'count':q['count'],'repair':repair,'unit_ids':[str(uuid4()) for _ in range(q['count'])],'started_at':now,'complete_at':now+q['duration']}
    engine.state.defenses['queue'].append(job);return job


def validate_defenses(catalog,state):
    if state.universe is None:return
    ids=set()
    for u in state.defenses.get('units',[]):
        item=catalog.get('defenses',u['type'])
        if item.kind!='structure' or u['id'] in ids or not isfinite(u['hp']) or not 0<u['hp']<=item.hull_points or not isfinite(u.get('charge',0)) or u.get('charge',0)<0:raise DataValidationError('Durabilidade defensiva inválida.')
        ids.add(u['id'])
    for key,n in state.defenses.get('ammunition',{}).items():
        if catalog.get('defenses',key).kind!='ammunition' or not isinstance(n,int) or not 0<=n<=10000:raise DataValidationError('Munição inválida.')
    for j in state.defenses.get('queue',[]):
        catalog.get('defenses',j['type'])
        if not 1<=j['count']<=50 or not isfinite(j['complete_at']) or j['complete_at']<j['started_at']:raise DataValidationError('Fila defensiva inválida.')
