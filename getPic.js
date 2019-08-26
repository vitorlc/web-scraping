const puppeteer = require('puppeteer');

async function getPic() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://amazon.com.br');
  await page.screenshot({path: 'google1.png'});

  await browser.close();
}

getPic();