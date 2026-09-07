// Run via playwright-cli run-code --filename=production/bake-wow-thumbs.cjs
// Open this checkout's local site first; outputs are relative to the CLI project directory.
async (page) => {
  const base = await page.evaluate(() => location.origin);
  const selected = await page.evaluate(() => new URL(location.href).searchParams.get('ids'));
  const ids = selected ? selected.split(',') : await page.evaluate(() => WOW_HEROES.filter(h => h.fullArt && h.fullArt.includes('imagegen-v1')).map(h => h.id));
  const results = [];
  const failures = [];
  for (const id of ids) {
    await page.goto(base + '/test/wow-qc.html?hero=' + id);
    await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);
    const report = await page.evaluate(() => window.qc || {error:document.getElementById('log').textContent});
    if (report.error) throw new Error(id + ': ' + report.error);
    const pass = report.optimized.roughPass && report.optimized.normalPass && report.lightPixelDelta >= 1 && report.goldLines.comps <= 30;
    await page.screenshot({path:'output/playwright/' + id + '-qc.png', fullPage:true});
    let pending;
    if (pass) {
      pending = page.waitForEvent('download');
      await page.getByRole('button', {name:'导出成卡缩略图'}).click();
      await (await pending).saveAs('assets/portraits/wow-runtime/' + id + '-imagegen-v1-thumb.webp');
    } else failures.push(id);
    pending = page.waitForEvent('download');
    await page.getByRole('button', {name:'导出 QC 数据'}).click();
    await (await pending).saveAs('production/wow-imagegen/' + id + '-qc.json');
    results.push({id, pass, ...report.optimized, comps:report.goldLines.comps, renderMs:report.renderMs});
  }
  if (failures.length) throw new Error('Material QC failed (reports saved): ' + JSON.stringify(results));
  return results;
}
