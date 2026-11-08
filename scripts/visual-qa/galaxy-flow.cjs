const assert = require('node:assert/strict');
const path = require('node:path');
const { inspectLayout } = require('./checks.cjs');
async function galaxyFlow(page, { output, fixture }) {
  const gpuErrors=[];const consoleError=message=>{if(message.type()==='error'&&/THREE|WebGL|shader|GL_INVALID/i.test(message.text()))gpuErrors.push(message.text().slice(0,500));};page.on('console',consoleError);
  page.setDefaultTimeout(20000);
  while (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
  const mobile = page.viewportSize().width === 390;
  const capture = name => page.screenshot({ path: path.join(output, `galaxy-${page.viewportSize().width}x${page.viewportSize().height}-${name}.png`) });
  const touch = async frames => {
    const cdp=await page.context().newCDPSession(page);
    try { await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:frames[0]});for(const touchPoints of frames.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); } finally { await cdp.detach(); }
  };
  const main = async () => { if (mobile) await page.getByRole('tab', { name: 'Mapa', exact: true }).click(); };
  const detail = async () => { if (mobile) await page.getByRole('tab', { name: 'Sistema e missão', exact: true }).click(); };
  const fits = async () => {
    const result = await page.evaluate(inspectLayout, { critical: ['.spatial-toolbar button'], inspectors: ['.galaxy-spatial-detail'], allowedScroll: [] });
    assert.deepEqual(result.findings, []);
  };
  await main(); const map = page.locator('.galaxy-space'); await map.waitFor(); await fits();
  await capture('strategic');
  const initial = await map.getAttribute('data-camera');
  await map.focus(); await page.keyboard.press('ArrowRight'); assert.notEqual(await map.getAttribute('data-camera'), initial);
  await page.getByRole('button', { name: 'Ampliar mapa espacial', exact: true }).click();
  const zoomed = await map.getAttribute('data-camera'); assert.notEqual(zoomed, initial);
  const box = await map.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 30); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height - 30); await page.mouse.up();
  assert.notEqual(await map.getAttribute('data-camera'), zoomed);
  const wheelBefore=await map.getAttribute('data-camera');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-120);await page.waitForTimeout(60);assert.notEqual(await map.getAttribute('data-camera'),wheelBefore);
  if(mobile){const previous=await map.getAttribute('data-camera'),x=box.x+box.width/2,y=box.y+box.height/2;await touch([35,45,55,65].map(d=>[{x:x-d,y},{x:x+d,y}]));assert.notEqual(await map.getAttribute('data-camera'),previous);assert(await map.isVisible(),'Pinch must not open the inspector');}
  const home = page.locator('.spatial-system.home'); await home.focus();
  if(mobile){const point=await home.locator('.system-hit').boundingBox();await touch([[{x:point.x+point.width/2,y:point.y+point.height/2}]]);await page.waitForTimeout(60);assert.equal(await page.getByRole('tab',{name:'Sistema e missão',exact:true}).getAttribute('aria-selected'),'true');}else await home.press('Enter');
  await main();
  const before = await map.elementHandle();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button', { name: 'Abrir sistema', exact: true }).click(); await main();
  const canvas = page.locator('.orbital-canvas'); await canvas.waitFor();
  await page.waitForFunction(() => Number(document.querySelector('.orbital-host')?.dataset.triangles) > 0);
  await page.waitForTimeout(400); await fits(); await capture('orbital');
  const host = page.locator('.orbital-host'), generation = await host.getAttribute('data-generation-count');
  const geometry=await host.evaluate(el=>({drawCalls:Number(el.dataset.drawCalls),triangles:Number(el.dataset.triangles),resolution:`${el.querySelector('canvas').width}x${el.querySelector('canvas').height}`}));
  const planetLabels = page.locator('.orbital-labels button'); assert(await planetLabels.count() > 0);
  const selector=page.getByRole('combobox',{name:'Selecionar planeta na órbita'});
  const firstIndex=await selector.locator('option:not(:disabled)').first().getAttribute('value');
  await selector.selectOption(firstIndex); await detail();
  await page.getByRole('tab', { name: 'Planeta', exact: true }).waitFor();
  const mission = page.locator('.travel-planner a[href*="plan=1"]'); assert((await mission.getAttribute('href')).includes('plan=1'));
  const canvasHandle = await canvas.elementHandle(); await main();
  assert(await canvasHandle.evaluate(el => el.isConnected)); assert.equal(await host.getAttribute('data-generation-count'), generation);
  const pause = page.getByRole('button', { name: 'Pausar', exact: true }); if(await pause.count())await pause.click();
  const cameraState=await host.evaluate(el=>[...el.dataset.cameraTarget.split(',').map(Number),Number(el.dataset.cameraZoom)]);
  const stock=fixture.state.stocks.components,population=fixture.state.population.total,previousResource=await page.locator('.resource-components strong').innerText();
  try{
    fixture.state.stocks.components=(stock??0)+100;fixture.state.population.total=population+1;
    await page.clock.fastForward(15001);
    await page.waitForFunction(previous=>document.querySelector('.resource-components strong')?.textContent!==previous,previousResource);
    assert(await canvasHandle.evaluate(el=>el.isConnected));assert.equal(await host.getAttribute('data-generation-count'),generation);const afterCamera=await host.evaluate(el=>[...el.dataset.cameraTarget.split(',').map(Number),Number(el.dataset.cameraZoom)]);afterCamera.forEach((value,i)=>assert(Math.abs(value-cameraState[i])<1e-8,'Resource updates must preserve the camera'));
  }finally{fixture.state.stocks.components=stock;fixture.state.population.total=population;}
  const beforeCamera = await page.screenshot();
  const sceneBox = await canvas.boundingBox();
  if(mobile){const x=sceneBox.x+30,y=sceneBox.y+sceneBox.height/2;await touch([[{x,y}],[{x:x+30,y:y+10}],[{x:x+60,y:y+20}]]);}else{await page.mouse.move(sceneBox.x+sceneBox.width/2,sceneBox.y+sceneBox.height/2);await page.mouse.down();await page.mouse.move(sceneBox.x+sceneBox.width/2-60,sceneBox.y+sceneBox.height/2+20);await page.mouse.up();}
  await page.mouse.move(sceneBox.x+sceneBox.width*.65,sceneBox.y+sceneBox.height*.5);await page.mouse.wheel(0,-120);
  await page.getByRole('button', { name: 'Ampliar vista orbital', exact: true }).click(); await page.waitForTimeout(200);
  assert(!beforeCamera.equals(await page.screenshot())); await capture('orbital-inspection');
  await page.getByRole('button',{name:'Enquadrar sistema',exact:true}).click();await page.waitForTimeout(100);assert.equal(await host.getAttribute('data-camera-target'),'0,0,0');assert.equal(await host.getAttribute('data-camera-zoom'),'1');
  await page.getByRole('button', { name: '← Galáxia', exact: true }).click(); await canvas.waitFor({ state: 'detached' });
  assert(await before.evaluate(el => el.isConnected)); await fits();
  const unknown = page.locator('.spatial-system.unknown').first(); await unknown.focus(); await unknown.press('Enter'); await detail();
  assert.equal(await page.getByRole('button', { name: 'Abrir sistema', exact: true }).count(), 0);
  assert.equal(await page.locator('.galaxy-planet').count(), 0); assert((await page.locator('.travel-planner a[href*="plan=1"]').getAttribute('href')).includes('mission=SURVEY'));
  const missionHref = await page.locator('.travel-planner a[href*="plan=1"]').getAttribute('href');
  await page.locator('.travel-planner a[href*="plan=1"]').click(); await page.waitForFunction(() => location.hash.startsWith('#/fleets?plan=1'));
  assert.equal(await page.getByLabel('Coordenada X', { exact: true }).inputValue(), new URLSearchParams(missionHref.split('?')[1]).get('x'));
  assert.equal(await page.getByLabel('Coordenada Y', { exact: true }).inputValue(), new URLSearchParams(missionHref.split('?')[1]).get('y'));
  assert.deepEqual(gpuErrors,[]);page.off('console',consoleError);
  return { kind: 'spatial-galaxy', passed: true, geometry, checks: ['camera pan/zoom/wheel', ...(mobile?['touch pinch','touch selection','touch orbital rotation']:[]), 'keyboard selection', 'orbital renderer', 'planet inspection', 'no geography/canvas rebuild on selection or population/stock refresh', 'no WebGL console errors', 'orbital camera', 'dispose on close', 'map retained', 'unknown privacy', 'real mission planner destination'] };
}
module.exports = { galaxyFlow };
