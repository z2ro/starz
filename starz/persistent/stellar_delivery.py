"""Physical module/cargo manifests on existing paid fleet missions."""
from math import isfinite
from uuid import UUID
from ..data import DataValidationError
from ..db import models as m
from ..progression import level


def require(condition,message):
    if not condition:raise DataValidationError(message)


def shipment(session,empire,engine,data):
    from .stellar import MODULE_CARGO
    project=session.get(m.StellarProject,UUID(data['stellar_project_id'])) if data.get('stellar_project_id') else None
    require(project is not None and project.universe_id==empire.universe_id and project.empire_id==empire.id and project.status in {'reserved','building'},'Projeto estelar não autorizado.')
    require(level(engine.state,'stellar_logistics')>=1,'Requer Logística Estelar.')
    source=session.get(m.StellarSource,project.source_id);system=session.get(m.StarSystem,source.origin_system_id)
    ids=data.get('module_ids',[])
    require(len(ids)<=50 and len(set(ids))==len(ids),'Manifesto de módulos inválido.')
    modules=[session.get(m.StellarModule,UUID(id)) for id in ids]
    require(all(u and u.empire_id==empire.id and u.universe_id==empire.universe_id and str(u.origin_planet_id)==engine.state.planet_id and u.status=='ready' for u in modules),'Módulo não está pronto neste planeta ou não pertence ao império.')
    cargo=data.get('cargo') or {}
    require(bool(modules or cargo),'Remessa estelar vazia.')
    require(all(key in engine.catalog.items['resources'] or key in engine.catalog.items['fuels'] for key in cargo),'Recurso desconhecido.')
    require(all(type(n) in (int,float) and isfinite(n) and 0<n<=1e9 for n in cargo.values()),'Carga deve ser positiva e finita.')
    return project,system,modules,cargo,len(modules)*MODULE_CARGO+sum(cargo.values())


def return_modules(session,order,origin_planet_id):
    for id in order.payload.get('module_ids',[]):
        module=session.get(m.StellarModule,UUID(id))
        require(module is not None and module.empire_id==order.empire_id and module.universe_id==order.universe_id,'Manifesto de retorno não autorizado.')
        if module.status=='transit':
            require(module.fleet_id==UUID(order.payload['fleet_id']) and str(module.origin_planet_id)==origin_planet_id,'Origem de módulo inconsistente.')
            module.status='ready';module.fleet_id=None;module.project_id=None;module.updated_at=order.due_at


def launch(session,project,modules,fleet_id,order_id):
    fleet=session.get(m.Fleet,UUID(fleet_id))
    require(fleet is not None and fleet.empire_id==project.empire_id and fleet.status=='TRANSIT','Entrega exige frota própria em trânsito.')
    source=session.get(m.StellarSource,project.source_id);system=session.get(m.StarSystem,source.origin_system_id)
    require((fleet.destination_x,fleet.destination_y)==(system.x,system.y),'Rota fora do projeto.')
    for module in modules:
        module.status='transit';module.project_id=project.id;module.fleet_id=fleet.id;module.delivery_order_id=order_id


def deliver(session,order,engine):
    if order.resolved or order.payload.get('stellar_delivery_applied'):return
    p=order.payload;project=session.get(m.StellarProject,UUID(p['project_id']))
    require(project is not None and project.universe_id==order.universe_id and project.empire_id==order.empire_id and project.status in {'reserved','building'},'Destino estelar indisponível.')
    source=session.get(m.StellarSource,project.source_id);system=session.get(m.StarSystem,source.origin_system_id)
    fleet=next((f for f in engine.state.fleets if f['id']==p['fleet_id']),None)
    require(fleet is not None and fleet['status']=='ARRIVED' and (fleet['x'],fleet['y'])==(system.x,system.y),'Frota não chegou ao projeto.')
    ids=p.get('module_ids',[])
    require(len(ids)==len(set(ids)),'Módulos duplicados.')
    modules=[session.get(m.StellarModule,UUID(id)) for id in ids]
    require(all(module is not None and module.universe_id==order.universe_id and module.empire_id==order.empire_id and module.project_id==project.id and module.fleet_id==UUID(p['fleet_id']) and module.status=='transit' for module in modules),'Manifesto estelar inconsistente.')
    cargo=p.get('cargo',{})
    require(all((r in engine.catalog.items['resources'] or r in engine.catalog.items['fuels']) and type(n) in (int,float) and isfinite(n) and n>0 for r,n in cargo.items()),'Carga estelar inválida.')
    for module in modules:
        module.status='delivered';module.fleet_id=None;module.updated_at=order.due_at
    stocks=dict(project.stocks)
    for key,n in cargo.items():stocks[key]=stocks.get(key,0)+n
    project.stocks=stocks;project.updated_at=order.due_at
    order.payload={**p,'stellar_delivery_applied':True}
    engine.state.notices.insert(0,'Módulos e suprimentos entregues fisicamente ao projeto estelar.')
