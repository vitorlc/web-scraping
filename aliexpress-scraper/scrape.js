const puppeteer = require('puppeteer');

let scrape = async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto('https://pt.aliexpress.com');
    await page.setViewport({width: 1000, height: 1070})
    await page.click('body > div.ui-window.ui-window-normal.ui-window-transition.ui-newuser-layer-dialog > div > div > a')
    await page.focus('#search-key')
    await page.keyboard.type('Miband 4')
    await page.click('#form-searchbar > div.searchbar-operate-box > input')
    await page.waitFor(5000);

    const result = await page.evaluate(() => {
        let data = []
        let elements = document.querySelectorAll('.list-item');
        
        for (var element of elements){ // Loop through each proudct
            let title =  element.querySelector('.item-title').innerText;
            let price = element.querySelector('.price-current').innerText;
            data.push({title, price}); // Push an object with the data onto our array
        }
        console.table(data)
        return data;
    });
    // Scrape
    browser.close();
    return result;
};

scrape().then((value) => {
    console.log(value); // Success!
});