"""HTTP boundary: credentials, session ownership, strict finite mission payloads."""
from collections import defaultdict, deque
from threading import Lock
from time import time
from uuid import UUID
from urllib.parse import urlsplit
import secrets

from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from ..db import models as m
from ..db.store import utc
from ..data import DataValidationError
from ..progression import effect
from .security import COOKIE, SESSION_SECONDS, current_empire, password_hash, verify_password, token_hash

router=APIRouter()
attempts=defaultdict(deque)
rate_lock=Lock()


class Credentials(BaseModel):
    username: str = Field(pattern=r'^[a-zA-Z][a-zA-Z0-9_]{2,23}$')
    password: str = Field(min_length=12,max_length=128)


def gate(request):
    if not getattr(request.app.state,'persistent',False): raise HTTPException(404,'Modo persistente desabilitado.')
    return request.app.state.store


def throttle(request):
    key=request.client.host if request.client else 'local'
    now=time()
    with rate_lock:
        q=attempts[key]
        while q and q[0]<now-60:q.popleft()
        if len(q)>=15:raise HTTPException(429,'Muitas tentativas; aguarde um minuto.')
        q.append(now)
        if len(attempts)>2048:
            for k in list(attempts):
                if not attempts[k] or attempts[k][-1]<now-60:attempts.pop(k,None)


def issue(session,account,response,request):
    token=secrets.token_urlsafe(32)
    session.add(m.PlayerSession(token_hash=token_hash(token),account_id=account.id,expires_at=utc(time()+SESSION_SECONDS)))
    response.set_cookie(COOKIE,token,max_age=SESSION_SECONDS,httponly=True,samesite='strict',secure=request.url.scheme=='https',path='/api')
    return {'username':account.username,'empire_id':str(account.empire_id)}


@router.post('/api/auth/register')
def register(body:Credentials,request:Request,response:Response):
    store=gate(request);throttle(request)
    hashed=password_hash(body.password)
    with Session(store.database) as session,session.begin():
        store.lock(session)
        if session.scalar(select(m.PlayerAccount).where(m.PlayerAccount.username==body.username.lower())):raise HTTPException(409,'Nome indisponível.')
        empire=store.create_player(session,body.username.lower())
        account=m.PlayerAccount(username=body.username.lower(),password_hash=hashed,empire_id=empire.id,created_at=utc(time()))
        session.add(account);session.flush()
        return issue(session,account,response,request)


@router.post('/api/auth/login')
def login(body:Credentials,request:Request,response:Response):
    store=gate(request);throttle(request)
    with Session(store.database) as session,session.begin():
        account=session.scalar(select(m.PlayerAccount).where(m.PlayerAccount.username==body.username.lower()))
        encoded=account.password_hash if account else 'pbkdf2_sha256$'+'00'*16+'$'+'00'*32
        if not verify_password(body.password,encoded) or account is None:raise HTTPException(401,'Credenciais inválidas.')
        return issue(session,account,response,request)


@router.post('/api/auth/logout')
def logout(request:Request,response:Response):
    store=gate(request)
    with Session(store.database) as session,session.begin():
        session.execute(delete(m.PlayerSession).where(m.PlayerSession.token_hash==token_hash(request.cookies.get(COOKIE,''))))
    response.delete_cookie(COOKIE,path='/api')
    return {'logged_out':True}


@router.get('/api/auth/me')
def me(request:Request):
    store=gate(request)
    with Session(store.database) as session:
        account=session.scalar(select(m.PlayerAccount).where(m.PlayerAccount.empire_id==current_empire.get()))
        return {'username':account.username,'empire_id':str(account.empire_id)}


class Mission(BaseModel):
    model_config={'extra':'forbid'}
    planet_id: UUID | None = None
    ship_ids:list[str]=Field(min_length=1,max_length=100)
    mission:Literal['MOVE','SURVEY','COLONIZE','TRANSPORT','ATTACK','ESPIONAGE','EXPEDITION','RECON','REINFORCE']
    target_planet_id:UUID | None=None
    x:int=Field(default=0,ge=-100,le=100)
    y:int=Field(default=0,ge=-100,le=100)
    planet_index:int | None=Field(default=None,ge=0,le=20)
    cargo:dict[str,float]=Field(default_factory=dict,max_length=10)


def perform(request,call,planet_id=None):
    try:return gate(request).transaction(current_empire.get(),call,planet_id=planet_id)
    except (DataValidationError,ValueError) as exc:raise HTTPException(400,str(exc)) from exc


@router.get('/api/universe')
def overview(request:Request,planet_id:UUID | None=None):
    return perform(request,lambda session,empire,e:request.app.state.store.overview(session,empire,e),planet_id)


@router.post('/api/universe/mission-preview')
def mission_preview(body:Mission,request:Request):
    return perform(request,lambda session,empire,e:request.app.state.store.dispatch(session,empire,e,{**body.model_dump(mode='json'),'preview':True}),body.planet_id)


@router.post('/api/universe/mission')
def dispatch(body:Mission,request:Request):
    import math
    if any(not math.isfinite(n) or n<=0 or n>1e9 for n in body.cargo.values()):raise HTTPException(422,'Carga deve conter quantidades positivas e finitas.')
    data=body.model_dump(mode='json')
    return perform(request,lambda session,empire,e:request.app.state.store.dispatch(session,empire,e,data),body.planet_id)


class Diplomacy(BaseModel):
    target:UUID
    intent:Literal['war','propose','accept','neutral']


@router.post('/api/universe/diplomacy')
def diplomacy(body:Diplomacy,request:Request):
    return perform(request,lambda session,empire,e:request.app.state.store.diplomacy(session,empire,e,str(body.target),body.intent))


class Market(BaseModel):
    action:Literal['offer','accept','cancel']
    planet_id:UUID | None=None
    order_id:UUID | None=None
    give:str=Field(default='raw_ore',max_length=50)
    want:str=Field(default='refined_alloy',max_length=50)
    give_amount:float=Field(default=20,gt=0,le=1e8,allow_inf_nan=False)
    want_amount:float=Field(default=10,gt=0,le=1e8,allow_inf_nan=False)


@router.post('/api/universe/market')
def market(body:Market,request:Request):
    if body.action!='offer' and body.order_id is None:raise HTTPException(422,'Informe order_id.')
    return perform(request,lambda session,empire,e:request.app.state.store.market(session,empire,e,body.model_dump(mode='json')),body.planet_id)


class Recruit(BaseModel):
    planet_id:UUID | None=None
    amount:int=Field(default=10,ge=1,le=100)


@router.post('/api/universe/recruit')
def recruit(body:Recruit,request:Request):
    def command(session,empire,e):
        cap=(100+sum(e.catalog.get('districts',k).population_capacity*v for k,v in e.state.districts.items()))*(1+effect(e.catalog,e.state,'population'))
        if e.state.population_total+body.amount>cap:raise DataValidationError('Capacidade habitacional insuficiente.')
        e._pay({'volatiles':body.amount*2/(1+effect(e.catalog,e.state,'recruitment')),'components':body.amount*.2})
        e.state.population_total+=body.amount
        return {'population':e.state.population_total}
    return perform(request,command,body.planet_id)


class DefenseBuild(BaseModel):
    planet_id: UUID | None = None
    id: str = Field(pattern=r'^[a-z][a-z0-9_]*$')
    count: int = Field(default=1,ge=1,le=50,strict=True)
    repair: UUID | None = None


@router.post('/api/universe/defense')
def defense_build(body:DefenseBuild,request:Request):
    from ..defenses import build_defense
    return perform(request,lambda session,empire,e:build_defense(e,body.id,body.count,str(body.repair) if body.repair else None),body.planet_id)


class MissileLaunch(BaseModel):
    planet_id: UUID | None = None
    target: UUID
    count: int = Field(ge=1,le=50,strict=True)
    target_type: str | None = Field(default=None,pattern=r'^[a-z][a-z0-9_]*$')


@router.post('/api/universe/missiles')
def missile_launch(body:MissileLaunch,request:Request):
    return perform(request,lambda session,empire,e:request.app.state.store.launch_missiles(session,empire,e,str(body.target),body.count,body.target_type),body.planet_id)


class ResearchPlan(BaseModel):
    planet_id: UUID | None = None
    id: str = Field(pattern=r'^[a-z][a-z0-9_]*$')
    level: int | None = Field(default=None,ge=1,le=50,strict=True)


@router.post('/api/universe/research-plan')
def research_plan(body:ResearchPlan,request:Request):
    from .research_planning import plan_research
    return perform(request,lambda session,empire,e:plan_research(e,body.id,body.level),body.planet_id)


class FleetRecall(BaseModel):
    planet_id: UUID | None = None
    fleet_id: UUID

@router.post('/api/universe/recall')
def recall(body:FleetRecall,request:Request):
    return perform(request,lambda session,empire,e:request.app.state.store.recall(session,empire,e,str(body.fleet_id)),body.planet_id)
