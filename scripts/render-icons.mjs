import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/assets/mark.svg', import.meta.url), 'utf8');
const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const browser = await chromium.launch({ headless: true });

for (const [name, size, inset] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 51],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#f4f0e4}img{display:block;width:100%;height:100%;padding:${inset}px}</style><img src="${data}" alt="">`);
  await page.screenshot({ path: new URL(`../public/assets/${name}`, import.meta.url).pathname, omitBackground: false });
  await page.close();
}

await browser.close();
