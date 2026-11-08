"""Explicit synthetic UI snapshots. Never persisted or presented as live gameplay evidence."""
from starz.persistent import stellar, stellar_custody
from starz.persistent.combat_rules import STELLAR_RULES


def stellar_fixture(populated, state, empire_id, now):
    planet_id=state['active_planet']['id']
    system_id='81000000-0000-4000-8000-000000000001'
    source_id='82000000-0000-4000-8000-000000000001'
    project_id='83000000-0000-4000-8000-000000000001'
    unit_id='84000000-0000-4000-8000-000000000001'
    wreck_id='84000000-0000-4000-8000-000000000002'
    projects=[];modules=[];units=[]
    if populated:
        projects=[{'id':project_id,'project_id':project_id,'source_id':source_id,
            'status':'reserved','completed_phases':0,'x':2,'y':1,'phase_records':[],
            'stocks':{},'star_present':True}]
        modules=[{'id':f'85000000-0000-4000-8000-{index:012d}','kind':kind,'status':'ready',
            'origin_planet_id':planet_id,'current_planet_id':planet_id,'project_id':None,
            'fleet_id':None,'consumed_phase':None} for index,kind in enumerate(stellar.MODULE_KINDS,1)]
        units=[{'id':unit_id,'source_id':'82000000-0000-4000-8000-000000000002',
            'project_id':'83000000-0000-4000-8000-000000000002','system_id':system_id,
            'planet_id':planet_id,'state':'operational','stocks':{},'payload':{
                'profile':stellar.PROFILE,'original_owner_id':empire_id,
                'hp':STELLAR_RULES['structural_hp'],'shield':STELLAR_RULES['shield_capacity'],
                'subsystems':dict.fromkeys(stellar.MODULE_KINDS,STELLAR_RULES['subsystem_hp']),
                'energy':STELLAR_RULES['energy_capacity'],'energy_at':now}},
            {'id':wreck_id,'source_id':'82000000-0000-4000-8000-000000000003',
             'system_id':system_id,'planet_id':planet_id,'state':'sealed_wreck',
             'custodian_empire_id':empire_id,'custody_version':1,'stocks':{},
             'integrity':{'hp':0,'shield':0,'subsystems':dict.fromkeys(stellar.MODULE_KINDS,0),
                          'defeated_at':now-200000}}]
    for unit in units:
        unit['roles']={'operational_owner':unit['state']=='operational','historical_owner':True,
                       'custodian':unit['state']=='sealed_wreck','controller':True}
        unit['requires_server_validation']=True
    data={'projects':projects,'modules':modules,'units':units,'contacts':[],
        'profile':stellar.PROFILE,'experimental':True,'module_cargo':stellar.MODULE_CARGO,
        'module_cost':dict(stellar.MODULE_COST),'module_work':stellar.MODULE_WORK,
        'phase_seconds':stellar.PHASE_SECONDS,'phases':[{'phase':index,'module_kind':kind,'research':list(gates)}
            for index,(kind,gates) in enumerate(stellar.PHASES,1)]}
    custody={'units':units,'operations':([{'operation_id':'86000000-0000-4000-8000-000000000001',
        'unit_id':wreck_id,'kind':'claim','status':'completed','complete_at':now-60,
        'actor_id':empire_id,'recipient_id':None}] if populated else []),'profile':stellar_custody.PROFILE,'experimental':True,
        'stabilization_seconds':stellar_custody.STABILIZATION_SECONDS,
        'claim_seconds':stellar_custody.CLAIM_SECONDS,'rebuild_seconds':stellar_custody.REBUILD_SECONDS,
        'relic_seconds':stellar_custody.RELIC_SECONDS,'salvage_fraction':stellar_custody.SALVAGE_FRACTION}
    return data,custody
