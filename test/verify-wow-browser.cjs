// playwright-cli run-code --filename=test/verify-wow-browser.cjs
async (page) => {
  const base = await page.evaluate(() => location.origin);
  const errors = [];
  const failedResponses = [];
  const onError = error => errors.push(String(error));
  const onResponse = response => {
    if (response.url().startsWith(base) && response.status() >= 400) failedResponses.push({url:response.url(),status:response.status()});
  };
  page.on('pageerror', onError);
  page.on('response', onResponse);
  const ensure = (value, message) => { if (!value) throw new Error(message); };
  const ready = async p => p.waitForFunction(() => {
    const c=document.getElementById('cardLighting'); return c && !c.hidden;
  });
  const checksum = async p => p.evaluate(() => {
    const c=document.getElementById('cardLighting'),gl=c.getContext('webgl2');
    const data=new Uint8Array(c.width*c.height*4);
    gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let sum=0;for(let i=0;i<data.length;i+=64) sum=(sum*31+data[i])>>>0;
    return {sum,width:c.width,height:c.height,error:gl.getError()};
  });
  await page.setViewportSize({width:1280,height:900});
  await page.goto(base+'/wow.html#hero=jaina-proudmoore');
  await page.reload(); // also exercise startup when the runner reuses the same fragment URL
  await ready(page);
  ensure(await page.locator('#view').evaluate(el=>el.tagName==='SECTION'),'Full-page detail was replaced');
  const before=await checksum(page);
  const expectedDesktop=await page.locator('#cardLighting').evaluate(el=>Math.round(el.clientWidth*Math.min(Math.max(devicePixelRatio,2),2.5)));
  ensure(before.width===expectedDesktop,'Desktop supersampling does not match layout size');
  await page.screenshot({path:'output/playwright/wow-desktop-jaina.png'});
  const stage=page.locator('#stage');const bounds=await stage.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.15,bounds.y+bounds.height*.15);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const after=await checksum(page);
  ensure(before.sum!==after.sum && after.error===0,'Pointer light did not redraw');
  ensure(before.width===after.width && before.height===after.height,'Pointer tilt resized the drawing buffer');
  ensure(await page.evaluate(()=>{
    const gl=document.getElementById('cardLighting').getContext('webgl2');
    gl.activeTexture(gl.TEXTURE0);
    return gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER)===gl.LINEAR;
  }),'Diffuse detail was softened by mipmap filtering');

  const contextLossSupported=await page.evaluate(()=>{
    const c=document.getElementById('cardLighting');
    window.qcLoseExtension=c.getContext('webgl2').getExtension('WEBGL_lose_context');
    if(window.qcLoseExtension) window.qcLoseExtension.loseContext();
    return !!window.qcLoseExtension;
  });
  if(contextLossSupported){
    await page.waitForFunction(()=>document.getElementById('cardLighting').hidden);
    await page.evaluate(()=>window.qcLoseExtension.restoreContext());
    await ready(page);
    ensure((await checksum(page)).error===0,'Context restoration failed');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.8);
  ensure(await page.locator('#tilt').evaluate(el=>getComputedStyle(el).transform==='none'),'Reduced motion ignored');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.keyboard.press('Escape');
  ensure(await page.locator('#view').evaluate(el=>el.hidden),'Escape did not close');
  await page.getByRole('button',{name:'部落',exact:true}).click();
  ensure(await page.locator('#wowCount').textContent()==='8 位英雄','Horde filter failed');
  await page.getByRole('button',{name:'全部',exact:true}).click();
  const heroes=await page.evaluate(()=>WOW_HEROES.map(h=>({id:h.id,name:h.name.zh+' · '+h.title.zh})));
  ensure(heroes.length===24,'Warcraft roster is incomplete');
  const desktopDetails=[];
  for(const {id,name} of heroes){
    await page.getByRole('button',{name,exact:true}).click();await ready(page);
    const metrics=await checksum(page);
    ensure(metrics.error===0 && metrics.sum!==0,name+' failed rendering');
    desktopDetails.push({id,...metrics});
    await page.keyboard.press('Escape');
  }
  for (const cell of await page.locator('#wowGrid .cell').all()) await cell.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelectorAll('#wowGrid .is-pending').length===0);
  ensure(await page.locator('#wowGrid canvas').count()===24,'Missing gallery cards');
  await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});
  await page.screenshot({path:'output/playwright/wow-all-24.png',fullPage:true});
  const mobileContext=await page.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
  let mobileMetrics;
  try {
  const mobile=await mobileContext.newPage();mobile.on('pageerror',onError);mobile.on('response',onResponse);
  await mobile.goto(base+'/wow.html#hero=illidan-stormrage');await ready(mobile);
  mobileMetrics=await checksum(mobile);
  ensure(await mobile.evaluate(()=>document.documentElement.scrollWidth<=390),'Mobile horizontal overflow');
  const expectedWidth=await mobile.locator('#cardLighting').evaluate(el=>Math.round(el.clientWidth*Math.min(Math.max(devicePixelRatio,2),2.5)));
  ensure(mobileMetrics.width===expectedWidth && mobileMetrics.error===0,'High-DPR buffer does not match display size');
  await mobile.screenshot({path:'output/playwright/wow-mobile-390-dpr3.png'});
  mobileMetrics.details=[];
  for (const id of ['varian-wrynn','tyrande-whisperwind','cairne-bloodhoof','kaelthas-sunstrider','maiev-shadowsong']) {
    await mobile.keyboard.press('Escape');
    await mobile.getByRole('button',{name:heroes.find(hero=>hero.id===id).name,exact:true}).click();await ready(mobile);
    const metrics=await checksum(mobile);
    ensure(metrics.error===0 && metrics.sum!==0,'Mobile detail failed: '+id);
    ensure(await mobile.evaluate(()=>document.documentElement.scrollWidth<=390),'Mobile overflow: '+id);
    mobileMetrics.details.push({id,...metrics});
  }
  await mobile.screenshot({path:'output/playwright/wow-mobile-maiev-390-dpr3.png'});
  } finally { await mobileContext.close(); }

  const fallbackContext=await page.context().browser().newContext();
  try {
  await fallbackContext.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
  });
  const fallback=await fallbackContext.newPage();fallback.on('pageerror',onError);fallback.on('response',onResponse);
  await fallback.goto(base+'/wow.html#hero=kaelthas-sunstrider');
  await fallback.waitForFunction(()=>{
    const c=document.getElementById('cardCanvas');
    return !document.getElementById('view').hidden && c.getContext('2d').getImageData(500,500,1,1).data[3]>0;
  });
  ensure(await fallback.locator('#cardLighting').evaluate(el=>el.hidden),'2D fallback hidden');
  } finally { await fallbackContext.close(); }

  // The new main branch shares its page driver with the heritage gallery.
  // Keep that page's 2D detail, thumbnails, and life-map round trip intact.
  const heritageContext=await page.context().browser().newContext();
  try {
    const heritage=await heritageContext.newPage();heritage.on('pageerror',onError);
    await heritage.goto(base+'/guofeng.html#hero=libai');
    await heritage.waitForFunction(()=>{
      const c=document.getElementById('cardCanvas');
      return !document.getElementById('view').hidden && c.getContext('2d').getImageData(500,500,1,1).data[3]>0;
    });
    ensure(await heritage.locator('#grid img').count()===24,'Heritage gallery lost its 24 thumbnails');
    ensure(await heritage.locator('#cardLighting').count()===0,'Heritage rendering changed unexpectedly');
    await heritage.locator('#exploreBtn').click();
    await heritage.waitForFunction(()=>!document.getElementById('viewMap').hidden && document.getElementById('atlasMount').querySelector('img'));
    await heritage.screenshot({path:'output/playwright/merge-guofeng-map.png'});
    await heritage.locator('#mapBack').click();
    ensure(await heritage.locator('#view').isVisible(),'Map return did not restore the detail');
    await heritage.locator('#viewBack').click();
    ensure(await heritage.locator('#view').evaluate(el=>el.hidden) && await heritage.evaluate(()=>!location.hash),'Heritage return did not restore the wall');
  } finally { await heritageContext.close(); }
  page.off('pageerror',onError);
  page.off('response',onResponse);
  ensure(errors.length===0,'Page errors: '+errors.join('; '));
  ensure(failedResponses.length===0,'HTTP errors: '+JSON.stringify(failedResponses));
  const report={fullPageDetail:true,heritageGalleryAndMap:true,pointerLight:true,desktopSupersampling:before,stableBufferOnTilt:true,diffuseDetailSampling:true,contextLossSupported,contextRestored:contextLossSupported,
    reducedMotion:true,escapeClose:true,factionFilter:true,allFullArtDetails:desktopDetails,galleryCards:24,
    mobile390Dpr3:mobileMetrics,webglUnavailableFallback:true,pageErrors:errors,failedResponses};
  // Export through the browser so the CLI runner needs no filesystem capability.
  const pending=page.waitForEvent('download');
  await page.evaluate(report=>{
    const a=document.createElement('a');a.download='wow-browser-validation.json';
    a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(report,null,2));a.click();
  },report);
  await (await pending).saveAs('production/wow-imagegen/browser-validation.json');
  return report;
}
