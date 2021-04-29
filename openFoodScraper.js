const puppeteer = require('puppeteer')
const productScraperController = require('./productScraperController')

module.exports = async () => {
  const URL = 'https://world.openfoodfacts.org/'
  const IMAGE_URL = 'https://static.openfoodfacts.org/images/products/'

  const browser = await puppeteer.launch() //{ headless: false }
  const page = await browser.newPage()
  await page.goto(URL)
  // await page.setViewport({width: 1000, height: 1070})
  await page.waitForXPath('//*[@id="products_match_all"]')
  
  let itemsList = await page.$('#products_match_all')
  let elements = await itemsList.$$('li')

  for (let i = 0; i < elements.length; i++) {
    await elements[i].click()
    await page.waitForNavigation({ waitUntil: 'networkidle0' })
    const itemData = {}
    itemData.product_name = await page.$eval('#main_column > div:nth-child(4) > h1', el => el.innerText)
    itemData.code =  await page.$eval('#barcode', el => el.innerText)
    itemData.barcode = await page.$eval('#barcode_paragraph', el => el.innerText.replace('Barcode: ', ''))
    itemData.image_url = await page.$eval('#og_image', img => img.getAttribute('src')).catch(() => null);
    itemData.image_url2 = IMAGE_URL + itemData.code.split(new RegExp('^(...)(...)(...)(.*)$')).filter(Boolean).join('/')
    const [elementHandleQuantity] = await page.$x('//span[contains(., "Quantity")]/ancestor::p')
    itemData.quantity = !!elementHandleQuantity ? await elementHandleQuantity.evaluate(elm => elm.innerText.replace('Quantity: ', '')) : null
    const [elementHandleCategories] = await page.$x("//span[contains(., 'Categories')]/ancestor::p")
    itemData.categories = !!elementHandleCategories ? await elementHandleCategories.$$eval('a', a => a.map(n => n.innerText)): null
    const [elementHandlePacking] = await page.$x("//span[contains(., 'Packaging')]/ancestor::p")
    itemData.packaging = !!elementHandlePacking ? await elementHandlePacking.$$eval('a', a => a.map(n => n.innerText)): null
    const [elementHandleBrands] = await page.$x("//span[contains(., 'Brands')]/ancestor::p")
    itemData.brands = !!elementHandleBrands ? await elementHandleBrands.$$eval('a', a => a.map(n => n.innerText)): null
    itemData.url = page.url()
    await productScraperController(itemData)
   
    await page.goBack()
    itemsList = await page.$('#products_match_all')
    elements = await itemsList.$$('li')
  }
  console.log(`Total products imported: ${elements.length}`)
  await browser.close()
}