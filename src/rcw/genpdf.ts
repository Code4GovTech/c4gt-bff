import * as handlebars from 'handlebars';
import * as fs from 'fs';
import puppeteer from 'puppeteer';

export function compileTemplate(data: any, templateName: string) {
  const templateHtml = fs.readFileSync(`./templates/${templateName}`, 'utf8');
  // console.log('templateHtml', templateHtml);
  const template = handlebars.compile(templateHtml);
  return template(data);
}
export async function createPDF(data, pdfPath) {
  // const templateHtml = fs.readFileSync('./templates/final.html', 'utf8');
  // console.log('templateHtml', templateHtml);
  // const template = handlebars.compile(templateHtml);
  const html = compileTemplate(data, 'final.html');

  fs.writeFileSync(`./htmls/${pdfPath.split('/')[2]}.html`, html);

  const options = {
    height: 900 / 0.75,
    width: 600 / 0.75,
    scale: 1 / 0.75,
    landscape: true,
    displayHeaderFooter: false,
    printBackground: true,
    path: pdfPath,
  };

  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: 'new',
    defaultViewport: {
      width: 1024,
      height: 760,
    },
  });

  const page = await browser.newPage();

  await page.goto(
    `file:///home/techsavvyash/sweatAndBlood/samagra/C4GT/c4gt-bff/htmls/${pdfPath.split('/')[2]
    }.html`,
    { waitUntil: 'networkidle0' },
  );
  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight);
  });
  await page.pdf(options);

  await browser.close();
}
