// Playwright helper: fills a demo family so the poster can be eyeballed.
module.exports = async (page, { shot }) => {
  const clickName = async (label) => {
    const box = await page.evaluate((label) => {
      const g = [...document.querySelectorAll('.circle-person, .slot')]
        .find(el => el.textContent.trim().startsWith(label));
      if (!g) return null;
      const c = g.querySelector('circle.disc, ellipse.plaque, rect.slot-hit');
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    if (!box) throw new Error('not found: ' + label);
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(200);
  };
  const nameSlot = async (label, name) => {
    await clickName(label);
    await page.fill('.panel input[placeholder="الاسم"]', name);
    await page.click('.panel button[type=submit]');
    await page.waitForTimeout(200);
  };
  const away = async () => { await page.mouse.click(1250, 800); await page.waitForTimeout(120); };
  const addTo = async (who, list) => {
    await away(); await clickName(who);
    for (const [n, g] of list) {
      await page.fill('.pop input', n);
      await page.click(`.pop-seg button:has-text("${g === 'f' ? 'ابنة' : 'ابن'}")`);
      await page.click('.pop-add'); await page.waitForTimeout(140);
    }
  };
  const wifeFor = async (who, name) => {
    await away(); await clickName(who);
    await page.click('.pop-tabs button:has-text("زوجة")');
    await page.fill('.pop input', name);
    await page.click('.pop-add'); await page.waitForTimeout(200);
  };

  const anc = ['صالح','محمود','ناصر','فارس','عادل','سامي','بسام','زياد','رامي','كمال','جمال','إبراهيم'];
  for (let i = 0; i < 12; i++) await nameSlot(String(12 - i), anc[i]);
  await wifeFor('إبراهيم', 'أمينة');
  await addTo('إبراهيم', [['يوسف','m'],['هناء','f'],['عمر','m'],['ليلى','f']]);
  await addTo('يوسف', [['سامر','m'],['ندى','f'],['رامي','m']]);
  await addTo('هناء', [['كريم','m'],['سلمى','f']]);
  await addTo('عمر', [['طارق','m'],['رانيا','f'],['خالد','m']]);
  await addTo('سامر', [['أحمد','m'],['نور','f']]);
  await addTo('طارق', [['بلال','m'],['هدى','f']]);
  await addTo('كريم', [['زينة','f'],['وليد','m']]);
  await away();
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot });
};
