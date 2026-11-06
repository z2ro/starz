"""Real HTTP/timestamps only; new test accounts in the isolated 8033 service."""
import json,time,urllib.request,http.cookiejar,uuid,sys
from pathlib import Path
BASE='http://localhost:8033'
def client():
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(path,body=None):
        req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-Starz-Request':'1'})
        try:
            with opener.open(req,timeout=30) as response:return json.load(response)
        except urllib.error.HTTPError as exc:raise RuntimeError(exc.read().decode()) from exc
    return call

def wait(predicate,seconds=900):
    end=time.time()+seconds
    while time.time()<end:
        try:value=predicate()
        except urllib.error.URLError:
            time.sleep(3);continue
        if value:return value
        time.sleep(3)
    raise AssertionError('Real-time operation timed out')

def main():
    a,b=client(),client();suffix=uuid.uuid4().hex[:7];names=['warqa_a_'+suffix,'warqa_b_'+suffix];password='warfare_local_only_123'
    if '--resume' in sys.argv:
        saved=json.loads(Path('tmp/warfare-2/accounts.json').read_text());names=saved['accounts'];password=saved['password']
    for api,name in zip([a,b],names):api('/api/auth/'+('login' if '--resume' in sys.argv else 'register'),{'username':name,'password':password})
    Path('tmp/warfare-2').mkdir(parents=True,exist_ok=True)
    Path('tmp/warfare-2/accounts.json').write_text(json.dumps({'accounts':names,'password':password}))
    sa,sb=a('/api/state'),b('/api/state');ap,bp=sa['active_planet']['id'],sb['active_planet']['id']
    if sb.get('empire_levels',{}).get('naval_doctrine',0)<1 and not sb['research_domains']['military']['active']:b('/api/research',{'id':'naval_doctrine','planet_id':bp})
    if not sb['ships']:b('/api/build-ship',{'hull_id':'scout_hull','propulsion_id':'chemical_drive','fuel_id':'ion_fuel','planet_id':bp})
    needed=['scout_hull']*max(0,8-sum(s['hull_id']=='scout_hull' for s in sa['ships']))+['wayfarer_hull']*int(not any(s['hull_id']=='wayfarer_hull' for s in sa['ships']))
    for hull in needed:
        wait(lambda:a('/api/state')['capacities']['shipyard_slots_available']>0)
        a('/api/build-ship',{'hull_id':hull,'propulsion_id':'chemical_drive','fuel_id':'ion_fuel','planet_id':ap})
        print('built',hull,flush=True)
    wait(lambda:b('/api/state')['empire_levels'].get('naval_doctrine',0)>=1)
    if not b('/api/state')['defenses']['units'] and not any(j['type']=='point_defense' for j in b('/api/state')['defenses']['queue']):b('/api/universe/defense',{'id':'point_defense','count':1,'planet_id':bp})
    wait(lambda:len(b('/api/state')['defenses']['units'])==1)
    def ready_ships():
        state=a('/api/state')
        return state if all(v['ready_at']<=state['observed_at'] for v in state['ships']) else None
    sa=wait(ready_ships)
    scout=next(s['id'] for s in sa['ships'] if s['hull_id']=='scout_hull')
    body={'planet_id':ap,'ship_ids':[scout],'mission':'RECON','target_planet_id':bp}
    preview=a('/api/universe/mission-preview',body);assert preview['threat']['status']=='UNKNOWN'
    a('/api/universe/mission',body);print('reconnaissance dispatched',flush=True);intel=wait(lambda:a('/api/universe').get('intelligence'));assert intel[0]['planet_id']==bp
    wait(lambda:all(f['status']=='ARRIVED' for f in a('/api/state')['fleets']))
    u=a('/api/universe');enemy=next(p for p in u['players'] if p['name']==names[1]);a('/api/universe/diplomacy',{'target':enemy['id'],'intent':'war'})
    sa=a('/api/state');body.update(ship_ids=[s['id'] for s in sa['ships']],mission='ATTACK');preview=a('/api/universe/mission-preview',body);assert preview['threat']['status']=='CURRENT'
    a('/api/universe/mission',body);print('attack dispatched after intelligence review',flush=True);battle=wait(lambda:a('/api/universe').get('battles'));defender=b('/api/universe')['battles'];assert battle[0]['planet_id']==bp and defender[0]['at']==battle[0]['at'];assert battle[0]['attacker_losses'] or battle[0]['defender_losses']
    wait(lambda:all(f['status']=='ARRIVED' for f in a('/api/state')['fleets']))
    result={'accounts':names,'intelligence':intel[0],'preview':preview,'battle':battle[0],'realTimestampFlow':True,'noDirectDatabaseChanges':True,'defenderReport':True,'returned':True}
    Path('tmp/warfare-2/smoke.json').write_text(json.dumps(result,indent=2));print('PASS real reconnaissance → attack → losses → reports → return',flush=True)
if __name__=='__main__':main()
