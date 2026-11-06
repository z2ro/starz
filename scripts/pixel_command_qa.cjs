// Read-only browser QA against an existing local QA session, never production.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 assert(process.env.STARZ_QA_STORAGE,'Provide a Playwright storageState for a local QA account.');
 const base=process.env.STARZ_QA_URL||'http://localhost:8030';
 assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only local environments are supported.');
 const out=path.resolve('tmp/pixel-expansion/command');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const context=await browser.newContext({storageState:process.env.STARZ_QA_STORAGE,viewport:{width:1440,height:900}});
 const page=await context.newPage();const errors=[],mutations=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')mutations.push(r.url());});
 await page.goto(base+'/#/universe');await page.getByRole('heading',{name:'Centro de comando',exact:true}).waitFor();await page.locator('.px-viewport canvas').waitFor();await page.evaluate(()=>document.fonts.ready);
 const layouts=[];
 for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[390,844]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(600);
 const layout=await page.evaluate(()=>({width:innerWidth,page:document.documentElement.scrollWidth,font:document.fonts.check('16px Silkscreen'),planet:document.querySelector('.px-viewport').getBoundingClientRect().toJSON()}));
 assert(layout.page<=width,JSON.stringify(layout));assert(layout.font);layouts.push(layout);
 await page.screenshot({path:path.join(out,`${width}-command.png`),fullPage:true});
 }
 await page.getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByRole('region',{name:'Ajuda de comando'}).waitFor();
 await page.screenshot({path:path.join(out,'390-help.png'),fullPage:true});
 await page.getByRole('button',{name:'Fechar ajuda'}).click();assert.equal(await page.getByRole('region',{name:'Ajuda de comando'}).count(),0);
 await page.getByRole('button',{name:'Imagem',exact:true}).click();assert.equal(await page.locator('.px-viewport canvas').count(),0);
 await page.getByRole('button',{name:'Procedural',exact:true}).click();await page.locator('.px-viewport canvas').waitFor();
 await page.getByRole('button',{name:/Registros/}).click();await page.getByRole('region',{name:'Registros recentes'}).waitFor();await page.getByRole('button',{name:/Registros/}).click();
 await page.getByText('Como ler as taxas?',{exact:true}).click();assert(await page.getByText(/Produção nominal declarada pelas instalações/).isVisible());
 await page.getByRole('button',{name:'Ajuda',exact:true}).focus();await page.keyboard.press('Enter');assert(await page.getByRole('region',{name:'Ajuda de comando'}).isVisible());await page.getByRole('button',{name:'Fechar ajuda'}).click();
 for(const link of await page.getByRole('navigation',{name:'Ordens rápidas'}).getByRole('link').all())assert(['/development','/research','/shipyard','/galaxy'].includes((await link.getAttribute('href')).replace('#','')));
 await page.getByRole('navigation',{name:'Ordens rápidas'}).getByRole('link',{name:/Pesquisa/}).click();await page.getByRole('heading',{name:'Avançar tecnologias'}).waitFor();assert.equal(await page.locator('.pixel-command').count(),1);
 await page.goto(base+'/#/universe');await page.getByRole('heading',{name:'Centro de comando',exact:true}).waitFor();assert.equal(await page.locator('.pixel-command').count(),1);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(mutations.length,0,'Preview QA must not issue game orders');
 fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({layouts,errors,mutations,help:true,keyboard:true,records:true,imageProcedural:true,nominalExplanation:true,realNavigation:true,sharedPixelShell:true},null,2));
 console.log('PASS pixel direction browser QA');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
