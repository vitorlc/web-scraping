const puppeteer = require('puppeteer')

const args = process.argv.slice(2) //arguments from command line

const scrapeCEI = async () => {
    const url = 'https://cei.b3.com.br/CEI_Responsivo/';
    const browser = await puppeteer.launch() //{headless: false}
    const page = await browser.newPage()
    // await page.setViewport({width: 1200, height: 720})
    await page.goto(url, { waitUntil: 'networkidle0' })

    await page.type('#ctl00_ContentPlaceHolder1_txtLogin', args[0], {delay: 100})
    await page.type('#ctl00_ContentPlaceHolder1_txtSenha', args[1], {delay: 100})

    await page.click('#ctl00_ContentPlaceHolder1_btnLogar')
    await page.waitForNavigation({ waitUntil: 'networkidle0' })

    await page.click('#ctl00_ContentPlaceHolder1_sectionCarteiraAtivos')

    const result = await page.evaluate(() => {
        let data = []
        let elements = document.querySelectorAll('#ctl00_ContentPlaceHolder1_sectionCarteiraAtivos > .content > table > tbody > tr')
        
        for (var element of elements){ 
            let nome =  element.querySelectorAll('td')[0].innerText
            let valor = element.querySelectorAll('td')[1].innerText
            data.push({"nome": nome ,"valor": valor})
        }
        return data;
    });
    
    await browser.close();  
    
    console.log(result)
    return result
}

scrapeCEI()

module.exports = {
    scrapeCEI
}