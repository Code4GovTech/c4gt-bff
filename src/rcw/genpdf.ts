import * as handlebars from 'handlebars';
import * as fs from 'fs';
import puppeteer from 'puppeteer';
export async function createPDF(data, pdfPath) {
  const templateHtml = fs.readFileSync('./templates/final.html', 'utf8');
  // console.log('templateHtml', templateHtml);
  const template = handlebars.compile(templateHtml);
  const html = template(data);
  // const milis = new Date().getTime();
  // const pdfPath = `${data.name}-${milis}.pdf`;

  const options = {
    // width: 850,
    // height: 550,
    // landscape: true,
    // outerHeight: '500px',
    // headerTemplate: '<p></p>',
    // footerTemplate: '<p></p>',
    // displayHeaderFooter: false,
    // margin: {
    //   top: '10px',
    //   bottom: '30px',
    // },
    printBackground: true,
    path: pdfPath,
  };

  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: true,
    defaultViewport: {
      width: 850,
      height: 550,
    },
  });

  const page = await browser.newPage();

  await page.goto(`data:text/html;charset=UTF-8,${html}`, {
    waitUntil: 'networkidle0',
  });

  await page.pdf(options);
  await browser.close();
}
