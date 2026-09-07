// Run via playwright-cli run-code --filename=production/bake-wow-thumbs.cjs
// Open this checkout's local site first; outputs are relative to the CLI project directory.
async (page) => {
  const base = await page.evaluate(() => location.origin);
  const ids = ['jaina-proudmoore', 'thrall', 'arthas-menethil', 'illidan-stormrage'];
  const results = [];
  for (const id of ids) {
    await page.goto(base + '/test/wow-qc.html?hero=' + id);
    await page.waitForFunction(() => document.body.dataset.ready || document.body.dataset.error);
    const report = await page.evaluate(() => window.qc || {error:document.getElementById('log').textContent});
    if (report.error || !report.optimized.roughPass || !report.optimized.normalPass || report.lightPixelDelta < 1 || report.goldLines.comps > 30) {
      throw new Error(id + ' failed material QC: ' + JSON.stringify(report));
    }
    await page.screenshot({path:'output/playwright/' + id + '-qc.png', fullPage:true});
    let pending = page.waitForEvent('download');
    await page.getByRole('button', {name:'导出成卡缩略图'}).click();
    await (await pending).saveAs('assets/portraits/wow-runtime/' + id + '-imagegen-v1-thumb.webp');
    pending = page.waitForEvent('download');
    await page.getByRole('button', {name:'导出 QC 数据'}).click();
    await (await pending).saveAs('production/wow-imagegen/' + id + '-qc.json');
    results.push(report);
  }
  return results;
}
