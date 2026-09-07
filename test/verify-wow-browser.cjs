// playwright-cli run-code --filename=test/verify-wow-browser.cjs
async (page) => {
  const base = await page.evaluate(() => location.origin);
  const errors = [];
  const onError = error => errors.push(String(error));
  page.on('pageerror', onError);
  const ensure = (value, message) => { if (!value) throw new Error(message); };
  const ready = async p => p.waitForFunction(() => {
    const c=document.getElementById('wowCardLighting'); return c && !c.hidden;
  });
  const checksum = async p => p.evaluate(() => {
    const c=document.getElementById('wowCardLighting'),gl=c.getContext('webgl2');
    const data=new Uint8Array(c.width*c.height*4);
    gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let sum=0;for(let i=0;i<data.length;i+=64) sum=(sum*31+data[i])>>>0;
    return {sum,width:c.width,height:c.height,error:gl.getError()};
  });
  await page.setViewportSize({width:1280,height:900});
  await page.goto(base+'/wow.html#hero=jaina-proudmoore');
  await page.reload(); // also exercise startup when the runner reuses the same fragment URL
  await ready(page);
  const before=await checksum(page);
  const expectedDesktop=await page.locator('#wowCardLighting').evaluate(el=>Math.round(el.clientWidth*Math.min(Math.max(devicePixelRatio,2),2.5)));
  ensure(before.width===expectedDesktop,'Desktop supersampling does not match layout size');
  await page.screenshot({path:'output/playwright/wow-desktop-jaina.png'});
  const stage=page.locator('#wowStage');const bounds=await stage.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.15,bounds.y+bounds.height*.15);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const after=await checksum(page);
  ensure(before.sum!==after.sum && after.error===0,'Pointer light did not redraw');
  ensure(before.width===after.width && before.height===after.height,'Pointer tilt resized the drawing buffer');
  ensure(await page.evaluate(()=>{
    const gl=document.getElementById('wowCardLighting').getContext('webgl2');
    gl.activeTexture(gl.TEXTURE0);
    return gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER)===gl.LINEAR;
  }),'Diffuse detail was softened by mipmap filtering');

  const contextLossSupported=await page.evaluate(()=>{
    const c=document.getElementById('wowCardLighting');
    window.qcLoseExtension=c.getContext('webgl2').getExtension('WEBGL_lose_context');
    if(window.qcLoseExtension) window.qcLoseExtension.loseContext();
    return !!window.qcLoseExtension;
  });
  if(contextLossSupported){
    await page.waitForFunction(()=>document.getElementById('wowCardLighting').hidden);
    await page.evaluate(()=>window.qcLoseExtension.restoreContext());
    await ready(page);
    ensure((await checksum(page)).error===0,'Context restoration failed');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.8);
  ensure(await page.locator('#wowTilt').evaluate(el=>getComputedStyle(el).transform==='none'),'Reduced motion ignored');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.keyboard.press('Escape');
  ensure(await page.locator('#wowOverlay').evaluate(el=>el.hidden),'Escape did not close');
  await page.getByRole('button',{name:'部落',exact:true}).click();
  ensure(await page.locator('#wowCount').textContent()==='8 位英雄','Horde filter failed');
  await page.getByRole('button',{name:'全部',exact:true}).click();
  for(const name of ['萨尔 · 世界萨满','阿尔萨斯·米奈希尔 · 巫妖王','伊利丹·怒风 · 背叛者','希尔瓦娜斯·风行者 · 女妖之王']){
    await page.getByRole('button',{name,exact:true}).click();await ready(page);
    ensure((await checksum(page)).error===0,name+' failed rendering');
    await page.keyboard.press('Escape');
  }
  const mobileContext=await page.context().browser().newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
  let mobileMetrics;
  try {
  const mobile=await mobileContext.newPage();mobile.on('pageerror',onError);
  await mobile.goto(base+'/wow.html#hero=illidan-stormrage');await ready(mobile);
  mobileMetrics=await checksum(mobile);
  ensure(await mobile.evaluate(()=>document.documentElement.scrollWidth<=390),'Mobile horizontal overflow');
  const expectedWidth=await mobile.locator('#wowCardLighting').evaluate(el=>Math.round(el.clientWidth*Math.min(Math.max(devicePixelRatio,2),2.5)));
  ensure(mobileMetrics.width===expectedWidth && mobileMetrics.error===0,'High-DPR buffer does not match display size');
  await mobile.screenshot({path:'output/playwright/wow-mobile-390-dpr3.png'});
  } finally { await mobileContext.close(); }

  const fallbackContext=await page.context().browser().newContext();
  try {
  await fallbackContext.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
  });
  const fallback=await fallbackContext.newPage();fallback.on('pageerror',onError);
  await fallback.goto(base+'/wow.html#hero=jaina-proudmoore');
  await fallback.waitForFunction(()=>{
    const c=document.getElementById('wowCardCanvas');
    return !document.getElementById('wowOverlay').hidden && c.getContext('2d').getImageData(500,500,1,1).data[3]>0;
  });
  ensure(await fallback.locator('#wowCardLighting').evaluate(el=>el.hidden),'2D fallback hidden');
  } finally { await fallbackContext.close(); }
  page.off('pageerror',onError);
  ensure(errors.length===0,'Page errors: '+errors.join('; '));
  const report={pointerLight:true,desktopSupersampling:before,stableBufferOnTilt:true,diffuseDetailSampling:true,contextLossSupported,contextRestored:contextLossSupported,
    reducedMotion:true,escapeClose:true,factionFilter:true,allFiveFullArtDetails:true,
    mobile390Dpr3:mobileMetrics,webglUnavailableFallback:true,pageErrors:errors};
  // Export through the browser so the CLI runner needs no filesystem capability.
  const pending=page.waitForEvent('download');
  await page.evaluate(report=>{
    const a=document.createElement('a');a.download='wow-browser-validation.json';
    a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(report,null,2));a.click();
  },report);
  await (await pending).saveAs('production/wow-imagegen/browser-validation.json');
  return report;
}
