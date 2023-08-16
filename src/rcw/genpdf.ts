import * as handlebars from 'handlebars';
import * as fs from 'fs';
import puppeteer from 'puppeteer';
import { resolve } from 'path';

export function compileTemplate(data: any, templateName: string) {
  const templateHtml = fs.readFileSync(`./templates/${templateName}`, 'utf8');
  // console.log('templateHtml', templateHtml);
  const template = handlebars.compile(templateHtml);
  return template(data);
}

export function compileHBS(data: any, template: string) {
  const compiledTemplate = handlebars.compile(template);
  return compiledTemplate(data);
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
      height: 768,
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

export async function createPDFFromTemplate(data, template, pdfPath) {
  // const templateHtml = fs.readFileSync('./templates/final.html', 'utf8');
  // console.log('templateHtml', templateHtml);
  // const template = handlebars.compile(templateHtml);
  const compiledTemplate = handlebars.compile(template);
  const html = compiledTemplate(data);

  fs.writeFileSync(`./htmls/${pdfPath.split('/')[2]}.html`, html);
  const absolutePath = resolve(`./htmls/${pdfPath.split('/')[2]}.html`);
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
      height: 768,
    },
  });

  const page = await browser.newPage();
  await page.goto(
    // `file:///home/techsavvyash/sweatAndBlood/samagra/C4GT/c4gt-bff/htmls/${pdfPath.split('/')[2]
    // }.html`,
    `file://${absolutePath}`,
    { waitUntil: 'networkidle0' },
  );

  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight);
  });
  await page.pdf(options);

  await browser.close();
}
