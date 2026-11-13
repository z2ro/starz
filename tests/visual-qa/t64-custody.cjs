const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launch} = require('../../scripts/visual-qa/browser.cjs');

(async () => {
  const browser = await launch();
  const contexts = [];
  const names = JSON.parse(process.env.T64_NAMES);
  const unit = process.env.T64_UNIT, operation = process.env.T64_OPERATION;
  const base = process.env.T64_URL;
  async function login(page, name) {
    await page.goto(base + '/#/stellar');
    await page.getByLabel('Comandante').fill(name);
    await page.getByLabel(/Senha/).fill('synthetic-test-password');
    await page.getByRole('button', {name: 'Entrar', exact: true}).click();
    await page.getByRole('navigation', {name: 'Navegação principal'}).waitFor();
    await page.goto(base + '/#/stellar?tab=custody');
    await page.getByRole('tab', {name: 'Custódia', exact: true}).waitFor();
    await page.locator('.stellar-roster').waitFor();
  }
  async function privateAbsent(page) {
    const roster = page.locator('.stellar-roster');
    await roster.getByText('Nenhum núcleo visível sob propriedade ou custódia.').waitFor();
    const text = await page.locator('body').innerText();
    assert(!text.includes(unit.slice(0, 8)) && !text.includes(operation.slice(0, 8)));
    assert(!text.includes('Oferecer transferência'));
  }
  try {
    const pages = [];
    for (const name of names) {
      const context = await browser.newContext({viewport: {width: 1366, height: 768}});
      contexts.push(context);
      const page = await context.newPage();
      await login(page, name);
      pages.push(page);
    }
    const cookies = await Promise.all(contexts.map(context => context.cookies(base + '/api')));
    assert.equal(new Set(cookies.map(items => items.find(c => c.name === 'starz_universe_session')?.value)).size, 3);
    for (const page of pages.slice(0, 2)) {
      await page.locator('.stellar-roster').getByText(/Oferecer transferência/).waitFor();
      await page.locator('.stellar-roster').getByRole('button', {name: new RegExp(unit.slice(0, 8))}).waitFor();
    }
    await pages[0].getByRole('combobox', {name: /Ação de custódia/}).selectOption('cancel');
    await pages[1].getByRole('combobox', {name: /Ação de custódia/}).selectOption('accept');
    const selected = await pages[1].evaluate(async () => (await (await fetch('/api/universe/stellar/custody')).json()));
    const received = selected.units.find(item => item.id === unit);
    assert(received && received.location_status === 'UNKNOWN');
    for (const field of ['stocks', 'integrity', 'payload', 'technology']) assert(!(field in received));
    assert.equal(received.system_id, null); assert.equal(received.planet_id, null);
    await privateAbsent(pages[2]);
    for (const tab of ['Projetos', 'Unidades', 'Custódia']) {
      await pages[2].getByRole('tab', {name: tab, exact: true}).click();
      const text = await pages[2].locator('body').innerText();
      assert(!text.includes(unit.slice(0, 8)) && !text.includes(operation.slice(0, 8)));
    }
    await pages[2].goto(base + '/#/stellar?tab=custody&unit_id=' + unit + '&operation_id=' + operation);
    await privateAbsent(pages[2]);
    const sync = process.env.T64_SYNC;
    fs.writeFileSync(path.join(sync, 'ready'), '');
    while (!fs.existsSync(path.join(sync, 'proceed'))) await new Promise(resolve => setTimeout(resolve, 10));
    const attempts = await pages[2].evaluate(async ({unit, operation, home}) => {
      const get = await fetch('/api/universe/stellar/custody?planet_id=' + home);
      const post = await fetch('/api/universe/stellar/custody', {method:'POST', headers:{'Content-Type':'application/json','x-starz-request':'1'},
        body:JSON.stringify({action:'accept',unit_id:unit,operation_id:operation,idempotency_key:crypto.randomUUID()})});
      return [get.status, post.status];
    }, {unit, operation, home: process.env.T64_HOME});
    assert.deepEqual(attempts, [400, 400]);
    fs.writeFileSync(path.join(sync, 'done'), '');
    while (!fs.existsSync(path.join(sync, 'checked'))) await new Promise(resolve => setTimeout(resolve, 10));
    await pages[0].getByRole('button', {name:'Sair da conta'}).click();
    await login(pages[0], names[2]);
    await privateAbsent(pages[0]);
    console.log('T64: three separate browser contexts and account switch verified');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
