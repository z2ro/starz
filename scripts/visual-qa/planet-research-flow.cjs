const assert = require('node:assert/strict');
const path = require('node:path');

// Actual pointer input and SVG ports, on the runner's disposable local snapshots.
async function planetResearchFlow(page, { view, output }) {
  page.setDefaultTimeout(20000);
  while (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
  const mobile = page.viewportSize().width === 390;
  if (mobile) await page.getByRole('tab', { name: view === 'overview' ? 'Planeta' : 'Árvore', exact: true }).click();
  const capture = name => page.screenshot({ path: path.join(output, `${view}-${page.viewportSize().width}x${page.viewportSize().height}-${name}.png`) });
  if (view === 'overview') {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    if(page.viewportSize().height===650){await capture('short-before-toggle');console.log(JSON.stringify(await page.locator('.master-planet-hero,.strategy-world-modes,.px-mobile-dock').evaluateAll(nodes=>nodes.map(el=>({class:el.className,box:el.getBoundingClientRect().toJSON(),position:getComputedStyle(el).position,minHeight:getComputedStyle(el).minHeight})))));}
    await page.getByRole('button', { name: 'Imagem', exact: true }).click();
    assert.equal(await page.locator('.planet-procedural-stage').count(), 0);
    await capture('image');
    await page.getByRole('button', { name: 'Procedural', exact: true }).click();
    const canvas = page.locator('.planet-procedural-stage canvas'), guide = page.locator('.master-orbit-guide');
    await canvas.waitFor(); await page.waitForFunction(() => parseFloat(document.querySelector('.master-orbit-guide')?.style.width) > 0);
    await page.waitForTimeout(600);
    const bounds = await canvas.boundingBox(), ring = await guide.boundingBox();
    const stage = await page.locator('.planet-procedural-stage').boundingBox();
    assert(bounds && ring && stage);
    assert(ring.x >= stage.x && ring.y >= stage.y && ring.x + ring.width <= stage.x + stage.width + 1 && ring.y + ring.height <= stage.y + stage.height + 1, 'Guide must stay inside the scene');
    const hero = await page.locator('.master-planet-hero').boundingBox();
    assert(ring.x >= hero.x && ring.y >= hero.y && ring.x + ring.width <= hero.x + hero.width + 1 && ring.y + ring.height <= hero.y + hero.height + 1, 'Guide must stay inside the planet panel');
    const x = ring.x + ring.width / 2, y = ring.y + ring.height / 2;
    assert(await canvas.evaluate((el, p) => document.elementFromPoint(p.x, p.y) === el, { x, y }), 'Canvas must receive input, without a covering layer');
    console.log('Planet flow: paused canvas capture');
    const before = await canvas.screenshot(); await capture('procedural');
    console.log('Planet flow: rotation input');
    if (mobile) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 8, y: y + i * 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    } else {
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 90, y + 30, { steps: 1 }); await page.mouse.up();
    }
    await page.waitForTimeout(500);
    console.log('Planet flow: rotation comparison');
    assert(!before.equals(await canvas.screenshot()), 'Drag must change the paused rendered planet');
    console.log('Planet flow: zoom input');
    const prior = await guide.boundingBox();
    if (mobile) {
      const cdp = await page.context().newCDPSession(page);
      const fingers = distance => [{ x: x - distance, y }, { x: x + distance, y }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(55) });
      for (let distance = 50; distance >= 25; distance -= 5) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(distance) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
    } else { await page.mouse.move(x, y); await page.mouse.wheel(0, 500); }
    await page.waitForTimeout(500);
    assert((await guide.boundingBox()).width < prior.width - 2, 'Zoom must change the real camera projection');
    await capture('drag-zoom');
    await page.getByRole('button', { name: 'Imagem', exact: true }).click();
    assert.equal(await page.locator('.planet-procedural-stage').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Imagem', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Procedural', exact: true }).click(); await canvas.waitFor();
    return { kind: 'planet-input', passed: true, checks: ['guide contained', 'canvas hit testing', mobile ? 'touch rotation' : 'mouse rotation', 'camera zoom', 'image unmount', 'procedural restoration'] };
  }
  const verify = async () => {
    const errors = await page.evaluate(() => {
      const map = document.querySelector('.research-map'), scale = map.getBoundingClientRect().width / map.offsetWidth, errors = [];
      for (const edge of map.querySelectorAll('.research-edges path')) {
        const source = map.querySelector(`[data-tech-id="${edge.dataset.from}"]`).getBoundingClientRect(), target = map.querySelector(`[data-tech-id="${edge.dataset.to}"]`).getBoundingClientRect();
        const ctm = edge.getScreenCTM(), start = edge.getPointAtLength(0).matrixTransform(ctm), end = edge.getPointAtLength(edge.getTotalLength()).matrixTransform(ctm);
        if (Math.abs(start.x - source.right) > 1 || Math.abs(start.y - (source.top + source.height / 2)) > 1) errors.push('source port');
        if (Math.min(Math.abs(end.x - target.left), Math.abs(end.x - target.right)) > 1 || Math.abs(end.y - (target.top + target.height / 2)) > 1) errors.push('target port');
        if (!/^[MHV0-9., e+-]+$/.test(edge.getAttribute('d'))) errors.push('non-orthogonal path');
        for (const node of map.querySelectorAll('[data-tech-id]')) {
          const box = node.getBoundingClientRect();
          for (let distance = 2; distance < edge.getTotalLength() - 2; distance += 5 / scale) {
            const point = edge.getPointAtLength(distance).matrixTransform(ctm);
            if (point.x > box.left + 1 && point.x < box.right - 1 && point.y > box.top + 1 && point.y < box.bottom - 1) { errors.push('edge through card'); break; }
          }
        }
      }
      return errors;
    });
    assert.deepEqual(errors, []);
  };
  await page.waitForFunction(() => document.querySelectorAll('.research-edges path').length > 0);
  await verify(); await capture('connections');
  const original = await page.locator('.research-edges path').first().getAttribute('d');
  await page.getByRole('button', { name: 'Ampliar Árvore tecnológica', exact: true }).click(); await verify();
  await page.locator('.map-pan').evaluate(el => { el.scrollLeft = 180; el.scrollTop = 90; }); await verify();
  const coordinates = value => value.match(/-?\d+(?:\.\d+)?/g).map(Number);
  coordinates(await page.locator('.research-edges path').first().getAttribute('d')).forEach((value, i) => assert(Math.abs(value - coordinates(original)[i]) < .5, 'Navigation must keep local paths stable within subpixel rounding'));
  await capture('zoom-pan');
  await page.getByRole('button', { name: '110%', exact: true }).click();
  for (const domain of ['Civil', 'Militar', 'Fundamental']) {
    await page.getByRole('navigation', { name: 'Domínio científico' }).getByRole('button', { name: new RegExp('^' + domain) }).click();
    await page.waitForTimeout(100); await verify();
  }
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width - 24, height: viewport.height - 20 });
  await page.waitForTimeout(100); await verify();
  await page.setViewportSize(viewport); await page.waitForTimeout(100); await verify();
  return { kind: 'research-connections', passed: true, checks: ['measured ports', 'orthogonal paths', 'no card intersections', 'zoom', 'pan/scroll', 'all domains', 'resize'] };
}
module.exports = { planetResearchFlow };
