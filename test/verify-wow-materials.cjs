// Run via playwright-cli after opening wow.html in this checkout.
async (page) => {
  const base=await page.evaluate(()=>location.origin);
  await page.goto(base+'/wow.html');
  await page.waitForFunction(()=>window.CardArt && window.WOW_HEROES);
  const report=await page.evaluate(async()=>{
    const hero=WOW_HEROES.find(h=>h.id==='varian-wrynn');
    const load=src=>new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;
    });
    await document.fonts.ready;
    const [art,depth]=await Promise.all([load(hero.fullArt),load(hero.fullArtHeight)]);
    const options={externalMaps:{height:depth,fuseHeight:true}};
    const before=CardArt.paintFaceFull({...hero,fullArtNonMetalZones:undefined},art,options);
    const after=CardArt.paintFaceFull(hero,art,options);
    const changes={};
    const data={};
    for(const key of ['diffuse','height','normal','rough']){
      const a=before[key].getContext('2d').getImageData(0,0,CardArt.W,CardArt.H).data;
      const b=after[key].getContext('2d').getImageData(0,0,CardArt.W,CardArt.H).data;
      let count=0;for(let i=0;i<a.length;i+=4) if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]) count++;
      changes[key]=count;
      if(key==='rough'){data.before=a;data.after=b;}
    }
    const sample=(x,y)=>{
      const p=(Math.round(y*CardArt.H/1024)*CardArt.W+Math.round(x*CardArt.W/664))*4;
      return {before:data.before[p],after:data.after[p]};
    };
    return {id:hero.id,changedPixels:changes,sky:sample(146,380),armor:sample(336,550),frame:sample(22,500)};
  });
  for(const key of ['diffuse','height','normal']) if(report.changedPixels[key]!==0) throw new Error('Nonmetal regions changed '+key);
  if(report.changedPixels.rough<1000 || report.sky.after<=report.sky.before) throw new Error('Warm sky still receives metallic roughness');
  for(const key of ['armor','frame']) if(report[key].before!==report[key].after) throw new Error(key+' changed outside reviewed regions');
  const pending=page.waitForEvent('download');
  await page.evaluate(report=>{
    const a=document.createElement('a');a.download='material-regression.json';
    a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(report,null,2));a.click();
  },report);
  await (await pending).saveAs('production/wow-imagegen/material-regression.json');
  return report;
}
