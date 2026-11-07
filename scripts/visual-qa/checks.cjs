// Evaluated inside the real browser. No application state is modified.
function inspectLayout(profile) {
  const findings=[];
  const visible=el=>{const dialogs=document.querySelectorAll('dialog[open]'),dialog=dialogs[dialogs.length-1];if(dialog&&!dialog.contains(el)&&el!==dialog)return false;for(let p=el;p;p=p.parentElement){if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(el))return false;const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||p.hidden)return false;}return el.getClientRects().length>0;};
  const name=el=>el.id?`#${el.id}`:el.tagName.toLowerCase()+[...el.classList].map(c=>'.'+c).join('');
  const add=(code,el,detail)=>findings.push({code,element:el?name(el):'document',detail,text:el?.textContent?.trim().slice(0,90)});
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
  const clipped=el=>{
    const r=rect(el);if(r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1)return 'outside viewport';
    for(let p=el.parentElement;p;p=p.parentElement){if(p.tagName==='DIALOG'&&p.open)break;const s=getComputedStyle(p),b=rect(p);if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<b.left-2||r.right>b.right+2))return 'horizontal ancestor '+name(p);if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<b.top-2||r.bottom>b.bottom+2))return 'vertical ancestor '+name(p);}
    return null;
  };
  if(document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1)add('document-overflow',null,`${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight} > ${innerWidth}×${innerHeight}`);
  for(const el of document.querySelectorAll('body *')){
    if(!visible(el))continue;
    const s=getComputedStyle(el),x=el.scrollWidth>el.clientWidth+2,y=el.scrollHeight>el.clientHeight+2;
    if((x&&/auto|scroll/.test(s.overflowX))||(y&&/auto|scroll/.test(s.overflowY))){
      if(!profile.allowedScroll.some(selector=>el.matches(selector)))add('unwanted-scroll-container',el,`${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight}`);
    }
  }
  for(const selector of document.querySelector('dialog[open]')?['dialog[open] button,dialog[open] .mobile-sector-links a,dialog[open] .button,dialog[open] .px-primary']:profile.critical){
    const controls=[...document.querySelectorAll(selector)].filter(visible);
    if(!controls.length){add('missing-critical-control',null,selector);continue;}
    for(const el of controls){
      const why=clipped(el);if(why){add('clipped-critical-control',el,why);continue;}
      const r=el.getBoundingClientRect();if(r.height<43||r.width<43)add('small-critical-target',el,`${r.width}×${r.height}`);
      if(!el.disabled&&getComputedStyle(el).pointerEvents!=='none'){
        for(const [x,y] of [[r.left+r.width/2,r.top+r.height/2],[r.left+4,r.top+4],[r.right-4,r.bottom-4]]){const hit=document.elementFromPoint(x,y);if(hit!==el&&!el.contains(hit)){add('occluded-critical-control',el,hit?name(hit):'no hit target');break;}}
      }
    }
  }
  for(const selector of profile.inspectors){
    for(const inspector of document.querySelectorAll(selector)){
      if(!visible(inspector))continue;
      const lost=[...inspector.querySelectorAll('h2,h3,p,label,li,button,summary')].filter(visible).filter(el=>clipped(el));
      if(lost.length)add('inspector-content-unreachable-without-scroll',inspector,`${lost.length} visible content elements outside the reading area`);
    }
  }
  for(const el of document.querySelectorAll('.px-view button,.px-view label,.px-view h1,.px-view h2,.px-view p,.px-view .metric,.px-view .data-row'))if(visible(el)&&!el.closest('.map-pan')&&clipped(el))add('clipped-workspace-content',el,clipped(el));
  for(const el of document.querySelectorAll('.page-item'))if(visible(el)&&clipped(el))add('clipped-page-content',el,clipped(el));
  for(const img of document.images)if(visible(img)&&(!img.complete||!img.naturalWidth))add('unloaded-image',img,'image missing or not decoded');
  for(const icon of document.querySelectorAll('.px-icon'))if(visible(icon)&&getComputedStyle(icon).shapeRendering!=='crispedges')add('pixel-icon-filter',icon,'expected crispEdges');
  for(const canvas of document.querySelectorAll('canvas'))if(visible(canvas)&&(!canvas.width||!canvas.height))add('empty-canvas',canvas,'zero backing resolution');
  for(const el of document.querySelectorAll('[data-pixel-art]'))if(visible(el)&&!['pixelated','crisp-edges'].includes(getComputedStyle(el).imageRendering))add('pixel-asset-smoothing',el,'nearest-neighbor rendering missing');
  if(document.querySelector('.pixel-game')&&!document.fonts.check('16px Silkscreen'))add('pixel-font-unloaded',null,'Silkscreen font has not loaded');
  return {viewport:{width:innerWidth,height:innerHeight},findings,manualVisualReviewRequired:true};
}

async function exerciseNavigation(page,profile,onSubview) {
  const results=[];if(await page.locator('dialog[open]').count())return results;
  for(let index=0;index<await page.getByRole('tablist').count();index++){
    const group=page.getByRole('tablist').nth(index);if(!await group.isVisible())continue;
    const tabs=group.getByRole('tab');if(await tabs.count()<2)continue;
    let original=0;for(let i=0;i<await tabs.count();i++)if(await tabs.nth(i).getAttribute('aria-selected')==='true')original=i;
    const targets=profile?Array.from({length:await tabs.count()},(_,i)=>i).filter(i=>i!==original):[original===0?1:0];
    for(const target of targets){const before=await page.locator('main').innerText();
     await tabs.nth(target).click();await page.waitForTimeout(100);const selected=await tabs.nth(target).getAttribute('aria-selected')==='true';
     const changed=before!==await page.locator('main').innerText();const findings=profile?(await page.evaluate(inspectLayout,{...profile,critical:[]})).findings:[];
     if(onSubview)await onSubview(index,target);
     results.push({kind:'tabs',label:await group.getAttribute('aria-label'),passed:selected&&changed,findings});
    }
    await tabs.nth(original).click();await page.waitForTimeout(80);
  }
  const pagers=page.locator('[data-qa-pagination],nav[aria-label*="Paginação"],nav[aria-label*="Pagination"]');
  for(let i=0;i<await pagers.count();i++){
    const pager=pagers.nth(i);if(!await pager.isVisible())continue;
    const next=pager.locator('[data-qa-next],button[aria-label*="Próxima"],button[aria-label*="Next"]').first();
    if(!await next.count()||await next.isDisabled())continue;
    const before=await page.locator('main').innerText();await next.click();const changed=before!==await page.locator('main').innerText();results.push({kind:'pagination',passed:changed});
    const previous=pager.locator('[data-qa-previous],button[aria-label*="Anterior"],button[aria-label*="Previous"]').first();
    if(await previous.count()&&!await previous.isDisabled())await previous.click();
  }
  return results;
}
async function auditContentPages(page,profile){
 const findings=[],results=[];const modals=page.locator('dialog[open]'),modal=modals.last();const decks=await modals.count()?modal.locator('.content-pages'):page.locator('.content-pages');
 for(let i=0;i<await decks.count();i++){
  const deck=decks.nth(i);if(!await deck.isVisible())continue;
  const nav=deck.locator(':scope > nav'),previous=nav.locator('[data-qa-previous]'),next=nav.locator('[data-qa-next]');
  const original=Number((await nav.locator('span b').innerText()).split('/')[0])-1;
  let guard=0;while(!await previous.isDisabled()&&guard++<100)await previous.click();
  let count=0;do{
   await page.waitForTimeout(30);const check=await page.evaluate(inspectLayout,{...profile,critical:[]});
   const label=await deck.getAttribute('aria-label');findings.push(...check.findings.map(f=>({...f,phase:'content-page',deck:label})));
   count++;if(await next.isDisabled())break;await next.click();
  }while(count<100);
  results.push({kind:'content-pages',label:await deck.getAttribute('aria-label'),pages:count,passed:count<100});
  guard=0;while(!await previous.isDisabled()&&guard++<100)await previous.click();
  for(let n=0;n<original&&!await next.isDisabled();n++)await next.click();
 }
 return {findings,results};
}
module.exports={inspectLayout,exerciseNavigation,auditContentPages};
