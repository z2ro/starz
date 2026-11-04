"""Real isolated HTTP verification; no database edits or test-only endpoints."""
import json,time,httpx,os
from pathlib import Path
ROOT=os.environ.get('PERSISTENT_URL','http://localhost:8030')
assert httpx.get(ROOT+'/api/config').json().get('persistent'), 'Use only the isolated persistent server'
H={'x-starz-request':'1'}
a=httpx.Client(base_url=ROOT,headers=H,timeout=60);b=httpx.Client(base_url=ROOT,headers=H,timeout=60)
suffix=str(int(time.time()))[-6:]
users=['pilot_a_'+suffix,'pilot_b_'+suffix]
def post(c,path,body):
 r=c.post('/api/'+path,json=body);assert r.status_code==200,(path,r.status_code,r.text);return r.json()
assert httpx.get(ROOT+'/api/state').status_code==401
assert httpx.post(ROOT+'/api/auth/register',json={'username':'bad','password':'local-password-123'}).status_code==403
for c,name in zip((a,b),users):post(c,'auth/register',{'username':name,'password':'local-starz-password-123'})
sa=a.get('/api/state').json();sb=b.get('/api/state').json()
assert sa['active_planet']['id']!=sb['active_planet']['id']
assert a.get('/api/state',params={'planet_id':sb['active_planet']['id']}).status_code==400
assert a.post('/api/campaign/new',json={}).status_code==404
post(a,'research',{'id':'computing'});post(a,'build-ship',{'hull_id':'scout_hull','propulsion_id':'chemical_drive','fuel_id':'ion_fuel'})
post(b,'research',{'id':'logistics'})
post(b,'universe/market',{'action':'offer','give':'volatiles','want':'raw_ore','give_amount':30,'want_amount':20})
start=time.time();ore=sa['stocks']['raw_ore'];first=False;second=False
while time.time()-start<600:
 s=a.get('/api/state').json()
 if not first and s['empire_levels'].get('computing')==1:
  post(a,'research',{'id':'computing'});first=True
 if len(s['ships'])==1 and s['ships'][0]['ready_at']<=s['observed_at'] and not s['construction']:
  # Build the second vessel once, no repeat orders.
  if not second:
   post(a,'build-ship',{'hull_id':'scout_hull','propulsion_id':'chemical_drive','fuel_id':'ion_fuel'});second=True
 if s['empire_levels'].get('computing')==2 and len(s['ships'])==2 and all(x['ready_at']<=s['observed_at'] for x in s['ships']):break
 time.sleep(5)
s=a.get('/api/state').json();assert s['empire_levels'].get('computing')==2,s['research']
assert s['stocks']['raw_ore']>ore
u=a.get('/api/universe').json();assert u['fleet_limit']==4
f=post(a,'universe/mission',{'ship_ids':[x['id'] for x in s['ships']],'mission':'MOVE','x':s['system']['x'],'y':s['system']['y']})
assert len(f['ship_ids'])==2
# Same-system test flight has an honest 0.25 distance, resolved by the normal worker.
while time.time()<f['arrival_at']+8:
 ss=a.get('/api/state').json()
 if any(x['id']==f['id'] and x['status']=='ARRIVED' for x in ss['fleets']):break
 time.sleep(3)
assert next(x for x in a.get('/api/state').json()['fleets'] if x['id']==f['id'])['status']=='ARRIVED'
ua=a.get('/api/universe').json();ub=b.get('/api/universe').json()
post(a,'universe/diplomacy',{'target':ub['empire_id'],'intent':'propose'})
post(b,'universe/diplomacy',{'target':ua['empire_id'],'intent':'accept'})
assert next(p for p in a.get('/api/universe').json()['players'] if p['id']==ub['empire_id'])['relation']['status']=='allied'
post(a,'auth/logout',{});assert a.get('/api/state').status_code==401
assert b.get('/api/state').status_code==200
post(a,'auth/login',{'username':users[0],'password':'local-starz-password-123'})
assert a.get('/api/state').json()['active_planet']['id']==sa['active_planet']['id']
Path('/tmp/starz-persistent-smoke.json').write_text(json.dumps({'users':users,'two_accounts':True,'offline_level':2,'fleet_count':2,'arrival':True,'ownership_isolated':True,'csrf':True,'sessions_revoked':True,'elapsed_seconds':round(time.time()-start)},indent=2))
print('PASS real HTTP: accounts, levels, offline industry, multi-ship arrival, diplomacy, logout')
