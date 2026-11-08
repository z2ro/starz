const assert=require('node:assert/strict'),path=require('node:path');
const data=require('../../tests/fixtures/galaxyIdentity.json');
const {inspectLayout}=require('./checks.cjs');
async function galaxyVisualFlow(page,{output,fixture}){
 const original=structuredClone(fixture),mobile=page.viewportSize().width===390;
 const main=async()=>{if(mobile)await page.getByRole('tab',{name:'Mapa',exact:true}).click();};
 const capture=name=>page.screenshot({path:path.join(output,`visual-${page.viewportSize().width}x${page.viewportSize().height}-${name}.png`)});
 try{
  fixture.state=structuredClone(original.state);fixture.state.planets=[data.roster[0]];fixture.state.fleets=[];
  fixture.state.active_planet={id:data.roster[0].id,home:true,planet_index:1};fixture.state.system={...fixture.state.system,name:'Asterion',x:-2,y:-1};
  const system=structuredClone(data.systems.two);system.star.stellar_class=process.env.STARZ_QA_STELLAR_CLASS??'K';
  fixture.galaxy={radius:2,center:[-2,-1],home:[-2,-1],systems:[system,...[-1,0,1].flatMap(x=>[-2,0,1].map(y=>({id:`${x}:${y}`,x,y,home:false,distance:2,knowledge_level:'UNKNOWN',name:'PRIVATE_SYSTEM'})))]};
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('.galaxy-space').waitFor();await page.evaluate(()=>document.fonts.ready);await main();await page.waitForTimeout(200);await capture('map');
  assert.equal(await page.getByText('PRIVATE_SYSTEM',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Abrir sistema',exact:true}).click();await main();
  await page.waitForFunction(()=>Number(document.querySelector('.orbital-host')?.dataset.triangles)>0);await page.waitForTimeout(250);
  const initialLayout=await page.locator('.orbital-host').getAttribute('data-camera-layout');
  await capture('orbital');const host=page.locator('.orbital-host'),canvas=await page.locator('.orbital-canvas').elementHandle(),generation=await host.getAttribute('data-generation-count');
  const selector=page.getByRole('combobox',{name:'Selecionar planeta na órbita'});await selector.selectOption('1');await page.waitForTimeout(150);await capture('selection');
  await page.getByRole('button',{name:'Enquadrar sistema',exact:true}).click();await page.waitForTimeout(150);await capture('reset');assert.equal(await selector.inputValue(),'1');
  if(process.env.STARZ_QA_GALAXY_CAMERA_FLOW==='1'){
   const initial=JSON.parse(initialLayout),reset=JSON.parse(await host.getAttribute('data-camera-layout'));assert.equal(initial.length,reset.length);initial.forEach((p,i)=>assert(Math.hypot(p.x-reset[i].x,p.y-reset[i].y)<.5,'Paused initial framing and Reset must agree'));
   for(const disks of [initial,reset])for(let a=0;a<disks.length;a++)for(let b=0;b<a;b++)assert(Math.hypot(disks[a].x-disks[b].x,disks[a].y-disks[b].y)>disks[a].r+disks[b].r,'Default composition must separate bodies');
   assert.equal(await host.getAttribute('data-camera-target'),'0,0,0');assert.equal(await host.getAttribute('data-camera-zoom'),'1');assert.equal(await host.getAttribute('data-camera-moving'),'false');
   assert(Number(await host.getAttribute('data-star-radius'))>=1.4);
   await page.emulateMedia({reducedMotion:'no-preference'});await selector.selectOption('0');
   await page.waitForFunction(()=>document.querySelector('.orbital-host')?.dataset.cameraMoving==='true');
   await page.waitForFunction(()=>document.querySelector('.orbital-host')?.dataset.cameraMoving==='false');assert.notEqual(await host.getAttribute('data-camera-target'),'0,0,0');
   await page.getByRole('button',{name:'Enquadrar sistema',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await selector.selectOption('1');await page.getByRole('button',{name:'Enquadrar sistema',exact:true}).click();
  }
  const layout=await page.evaluate(inspectLayout,{critical:['.spatial-toolbar button'],inspectors:[],allowedScroll:[]});assert.deepEqual(layout.findings,[]);
  await page.getByRole('button',{name:'Animar',exact:true}).click();
  const timingStart=performance.now();await page.evaluate(()=>new Promise(resolve=>{let n=0,start=0;const frame=now=>{if(!start)start=now;if(++n===13)resolve((now-start)/12);else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));
  const animationSmokeMs=performance.now()-timingStart;await page.getByRole('button',{name:'Pausar',exact:true}).click();
  const metrics=await host.evaluate(el=>({drawCalls:Number(el.dataset.drawCalls),triangles:Number(el.dataset.triangles),starClass:el.dataset.starClass,frame:el.dataset.orbitalFrame,cameraLayout:el.dataset.cameraLayout}));
  await page.getByRole('button',{name:'Ampliar vista orbital'}).click();await page.waitForTimeout(80);assert.equal(await selector.inputValue(),'1');assert.equal(await host.getAttribute('data-generation-count'),generation);assert(await canvas.evaluate(el=>el.isConnected));
  if(process.env.STARZ_QA_GALAXY_CAMERA_FLOW==='1'&&page.viewportSize().width===1366){
   await page.getByRole('button',{name:'← Galáxia',exact:true}).click();
   const hidden=await page.addStyleTag({content:'.orbital-host{display:none!important}'});
   await page.getByRole('button',{name:'Abrir sistema',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.orbital-host')?.dataset.generationCount==='1');
   await hidden.evaluate(el=>el.remove());await page.waitForFunction(()=>document.querySelector('.orbital-host')?.dataset.cameraLayout&&document.querySelector('.orbital-host')?.dataset.cameraTarget==='0,0,0'&&document.querySelector('.orbital-host')?.dataset.cameraZoom==='1');
   assert.equal(await selector.inputValue(),'1');await capture('deferred-layout');
  }
  return{kind:'galaxy-visual' ,passed:true,metrics:{...metrics,animationSmokeMs,timingEnvironment:'wall time for 12 fixture animation callbacks; virtual browser clock; not FPS or a hardware benchmark'}};
 }finally{Object.assign(fixture,original);}
}
module.exports={galaxyVisualFlow};
