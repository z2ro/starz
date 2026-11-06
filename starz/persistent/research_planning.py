"""Read-only topological research plan; infrastructure is explicit, never purchased."""
from copy import deepcopy
from ..data import DataValidationError
from ..progression import level, research_quote, TIER_CAPACITY


def plan_research(engine,target,target_level=None):
    catalog=engine.catalog;state=deepcopy(engine.state);tech=catalog.get('technologies',target)
    maximum=1 if tech.kind=='breakthrough' else 50
    goal=target_level if target_level is not None else min(maximum,level(state,target)+1)
    if not isinstance(goal,int) or not 1<=goal<=maximum:raise DataValidationError('Nível de destino inválido.')
    steps=[];infrastructure={};capacity={};visiting=set()
    def visit(id,needed):
        if level(state,id)>=needed:return
        if id in visiting:raise DataValidationError('Ciclo nos pré-requisitos científicos.')
        visiting.add(id);t=catalog.get('technologies',id)
        if needed>(1 if t.kind=='breakthrough' else 50):raise DataValidationError('Pré-requisito excede o nível máximo.')
        refs={ref:1 for ref in t.requires if ref in catalog.items['technologies']}
        for ref,n in t.level_requires.items():refs[ref]=max(refs.get(ref,0),n)
        if t.tier>1 and not t.advances_tier:refs[f'{t.domain}_tier_{t.tier}']=1
        unlockers=sorted(x.id for x in catalog.items['technologies'].values() if id in x.unlocks)
        if unlockers and not any(level(state,key)>0 for key in unlockers):refs.setdefault(unlockers[0],1)
        for ref,n in sorted(refs.items()):visit(ref,n)
        local={ref:1 for ref in t.requires if ref in catalog.items['districts']}
        for ref,n in t.infrastructure.items():local[ref]=max(local.get(ref,0),n)
        for ref,n in local.items():
            current=state.districts.get(ref,0)
            if current<n:infrastructure[ref]={'id':ref,'current':current,'required':max(n,infrastructure.get(ref,{}).get('required',0))}
        science=engine.science()[t.domain];previous=capacity.get(t.domain,{}).get('required',0)
        capacity[t.domain]={'domain':t.domain,'current':science['capacity'],'required':max(previous,TIER_CAPACITY[t.tier-1]),'specialized':science['specialized'],'specialized_required':max(int(t.tier>1),capacity.get(t.domain,{}).get('specialized_required',0)),'rate':science['rate']}
        while level(state,id)<needed:
            q=research_quote(catalog,state,id);next_level=level(state,id)+1
            active=(engine.state.universe or {}).get('research_domains',{}).get(t.domain,{})
            in_progress=active.get('active')==id and next_level==level(engine.state,id)+1
            steps.append({'id':id,'level':next_level,'domain':t.domain,'tier':t.tier,'cost':{} if in_progress else q['cost'],'work':active['remaining_work'] if in_progress else q['work'],'in_progress':in_progress,'requirements':q['requirements']})
            state.universe.setdefault('levels',{})[id]=next_level
            if id not in state.research['completed']:state.research['completed'].append(id)
        visiting.remove(id)
    visit(target,goal)
    total={}
    for step in steps:
        for r,n in step['cost'].items():total[r]=total.get(r,0)+n
    return {'target':target,'level':goal,'steps':steps,'infrastructure':list(infrastructure.values()),'capacity':list(capacity.values()),'cost':total,'note':'Somente planejamento: não reserva recursos. Infraestrutura e energia precisam ser providenciadas; custos de construção não entram no subtotal. A ordem é topológica; domínios independentes podem trabalhar em paralelo.'}
