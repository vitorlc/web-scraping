const puppeteer = require('puppeteer')
const percent = require('percent')
const fs = require('fs')
var Pie = require("cli-pie");
const { getRandomRgb, temAtivos } = require('./utils')


const scrapeCEI = async (login, password) => {

    try {

        const url = 'https://cei.b3.com.br/CEI_Responsivo/';
        const browser = await puppeteer.launch() //{headless: false}
        const page = await browser.newPage()
        // await page.setViewport({width: 1200, height: 720})
        await page.goto(url, { waitUntil: 'networkidle0' })

        await page.type('#ctl00_ContentPlaceHolder1_txtLogin', login, { delay: 50 })
        await page.type('#ctl00_ContentPlaceHolder1_txtSenha', password, { delay: 50 })

        await page.click('#ctl00_ContentPlaceHolder1_btnLogar')
        await page.waitForNavigation({ waitUntil: 'networkidle0' })

        await page.click('#ctl00_ContentPlaceHolder1_sectionCarteiraAtivos')

        const resultSimples = await page.evaluate(() => {
            let dataSimples = []
            let elements = document.querySelectorAll('#ctl00_ContentPlaceHolder1_sectionCarteiraAtivos > .content > table > tbody > tr')

            let totalCalculado = 0
            for (var element of elements) {
                let nome = element.querySelectorAll('td')[0].innerText
                let valor = element.querySelectorAll('td')[1].innerText.replace("R$ ", "").replace(".", "").replace(",", ".")
                if (nome != 'Total da carteira') {
                    totalCalculado += parseFloat(valor)
                }
                dataSimples.push({ "nome": nome, "valor": valor })
            }

            let botaoTotal = elements[elements.length - 1].querySelectorAll('td > strong > a')[0]
            botaoTotal.click()
            return { dataSimples, totalCalculado };
        });

        await page.waitForNavigation({ waitUntil: 'networkidle0' })

        let resultAvancado = await page.evaluate(async () => {
            let dataAvancado = []
            let elements = document.querySelectorAll('#ctl00_ContentPlaceHolder1_updFiltro > div:nth-child(5) > div.large-12 > div.row')

            for (var element of elements) {
                if (element) {
                    if (element.querySelector('h2') !== null && element.querySelector('div.row') == null) { // Cabeçalho
                        let conta = element.querySelector('h2').innerText
                        dataAvancado.push({ 'Conta': conta })
                    } else if (element.querySelector('div.row') != null) { // table
                        let table = element.querySelectorAll('div.row > div.large-12 > .content > div:nth-child(2) > div.section-container > section > div.content > div > div > table > tbody > tr')
                        if (table.length == 0) {
                            dataAvancado.push('Sem Dados')
                        }
                        else {
                            for (let i = 0; i < table.length; i++) {
                                let acao = {}
                                acao.empresa = table[i].cells[0].innerText
                                acao.tipo = table[i].cells[1].innerText
                                acao.cod_negociacao = table[i].cells[2].innerText
                                acao.cod_ISIN = table[i].cells[3].innerText
                                acao.preco = table[i].cells[4].innerText.replace(".", "").replace(",", ".")
                                acao.qtd = table[i].cells[5].innerText
                                acao.fator_cotacao = table[i].cells[6].innerText
                                acao.valor = table[i].cells[7].innerText.replace(".", "").replace(",", ".")
                                dataAvancado.push(acao)
                            }
                        }
                        if (element.querySelectorAll('div.row > div.large-12 > .content > div:nth-child(3)') != null) { // Tabela Tesouro
                            table = element.querySelectorAll('div.row > div.large-12 > .content > div:nth-child(3) > div.section-container > section > div.content > div > table > tbody > tr')
                            for (let i = 0; i < table.length; i++) {
                                let tesouro = {}
                                tesouro.titulo = table[i].cells[0].innerText
                                tesouro.vencimento = table[i].cells[1].innerText
                                tesouro.investido = table[i].cells[2].innerText.replace(".", "").replace(",", ".")
                                tesouro.bruto_atual = table[i].cells[3].innerText.replace(".", "").replace(",", ".")
                                tesouro.liquido = table[i].cells[4].innerText.replace(".", "").replace(",", ".")
                                tesouro.total = table[i].cells[5].innerText
                                dataAvancado.push(tesouro)
                            }
                        }
                    }
                }
            }
            let arrayMaior = []
            let conta = {
                conta: null,
                ativos: []
            };

            for (let x of dataAvancado) {
                if (x['Conta']) {
                    conta = {
                        conta: x.Conta,
                        ativos: []
                    };
                    arrayMaior.push(conta)
                } else {
                    arrayMaior[arrayMaior.length - 1].ativos.push(x)
                }
            }
            return arrayMaior;
        })

        await browser.close()

        

        
        for (let data of resultSimples.dataSimples) { // Calcula o percentual do Resultado Simples
            data.percentual = percent.calc(parseFloat(data.valor), parseFloat(resultSimples.totalCalculado), 2)
        }
        
        resultAvancado = resultAvancado.filter(temAtivos) // Remove corretoras sem Ativos
        
        let total = []
        for (let corretora of resultAvancado) {
            corretora.total = 0
            for (let ativo of corretora.ativos) // Gera total por Corretora
                corretora.total = (parseFloat(ativo.valor) || parseFloat(ativo.bruto_atual)) + corretora.total
            
            for (let data of corretora.ativos) // Gera percentual
                data.percentual = percent.calc((parseFloat(data.valor) || parseFloat(data.bruto_atual)), parseFloat(corretora.total), 2)
            
            total.push(...corretora.ativos)
        }   

        let totalAtivos = 0
        var output = total.reduce((accumulator, cur) => { // Gera total por ativos
            totalAtivos = totalAtivos + (parseFloat(cur.valor)|| parseFloat(cur.bruto_atual))  
            var name = cur.cod_negociacao || cur.titulo
            var found = accumulator.find((elem) => {
                if (elem.cod_negociacao && elem.cod_negociacao == name) return elem
                else if (elem.titulo && elem.titulo == name) return elem
            })
            if (found) {
                found.qtd = parseInt(found.qtd) + parseInt(cur.qtd)
                found.valor = parseFloat(found.valor) + parseFloat(cur.valor)
                found.valor = found.valor.toFixed(2)
            }
            else accumulator.push(cur);
            return accumulator;
        }, [])

        for (let data of output){ // Gera percentual
            data.percentual = percent.calc((parseFloat(data.valor) || parseFloat(data.bruto_atual)), parseFloat(totalAtivos), 2)
        } 
        //console.log('Total:', totalAtivos.toFixed(2))
        //console.log(output)

        // fs.writeFile('resultAvancado.js', JSON.stringify(total), function(err) {
        //     if(err) {
        //         return console.log(err);
        //     }
        //     console.log("The file was saved!");
        // });

        imprimeResultadoSimples(resultSimples)
        imprimeResultadoAvancado(resultAvancado)
        imprimeResultadoAvancadoTotal(output)
        
        


        return { resultSimples, resultAvancado }
    } catch (e) {
        console.log('=====> ERROR', e)
    }
}


const imprimeResultadoSimples = (resultSimples) => {
    console.log("========= RESULTADO SIMPLES =========")

    dataSimplesPie = resultSimples.dataSimples
        .filter(item => item.nome != "Total da carteira")
        .map(item => {
            let teste = {}
            teste['label'] = item.nome
            teste['value'] = item.percentual
            teste['color'] = getRandomRgb()
            return teste
        })

    // Generate a new pie, with radius 5 characters
    var p = new Pie(5, dataSimplesPie, {
        legend: true
    });

    // Stringify
    console.log(p.toString());
}

const imprimeResultadoAvancado = (resultAvancado) => {
    console.log("\n\n========= RESULTADO AVANÇADO =========")


    for (let corretora of resultAvancado) {
        console.log("=========", corretora.conta, "=========")
        porCorretora = corretora.ativos.map(item => {
            let teste = {}
            teste['label'] = item.empresa || item.titulo
            teste['value'] = item.percentual
            teste['color'] = getRandomRgb()
            return teste
        })

        // Generate a new pie, with radius 5 characters
        var p = new Pie(5, porCorretora, {
            legend: true
        });

        // Stringify
        console.log(p.toString());
    }
}

const imprimeResultadoAvancadoTotal = (resultAvancado) => {
    console.log("\n\n========= RESULTADO TOTAL ATIVOS =========")

    porCorretora = resultAvancado.map(item => {
        let teste = {}
        teste['label'] = item.empresa || item.titulo
        teste['value'] = item.percentual
        teste['color'] = getRandomRgb()
        return teste
    })

    // Generate a new pie, with radius 5 characters
    var p = new Pie(5, porCorretora, {
        legend: true
    });

    // Stringify
    console.log(p.toString());
    
}


scrapeCEI()
