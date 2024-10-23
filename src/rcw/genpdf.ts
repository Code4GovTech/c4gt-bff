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
  const html = compileTemplate(data, 'MentorshipProgramParticipationCertTemplate.html');

  fs.writeFileSync(`./htmls/${pdfPath.split('/')[2]}.html`, html);

  const options = {
    height: 848 / 0.75,
    width: 570 / 0.75,
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
  await page.addStyleTag({ content: 'body { padding-botton: 50px; }' }); // Adjusts the top padding by 50 pixels.



  await page.goto(
    `file:/Users/kanavdwevedi/repositories/c4gt-bff/htmls/${pdfPath.split('/')[2]
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

  console.log("Call: CreatePDF",data,pdfPath)

  fs.writeFileSync(`./htmls/${pdfPath.split('/')[2]}.html`, html);
  const absolutePath = resolve(`./htmls/${pdfPath.split('/')[2]}.html`);
  console.log("Hello")
  const options = {
    height: 900,
    width: 680,
    // scale:
    landscape: true,
    displayHeaderFooter: false,
    printBackground: true,
    path: pdfPath,
    pageRanges: '1',
  };


  const browser = await puppeteer.launch(
    {
        args: ['--no-sandbox'],
        headless: true,
        defaultViewport: {
          width: 1024,
          height: 600,
        },
      });

  console.log(browser)

  const page = await browser.newPage();
  await page.goto(
    `file://${absolutePath}`,
    { waitUntil: 'networkidle0' },
  );
  await page.emulateMediaType('screen');

  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight);
  });
  await page.pdf(options);

  await browser.close();
}
