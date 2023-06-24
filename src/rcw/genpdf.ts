import * as handlebars from 'handlebars';
import * as fs from 'fs';
import puppeteer, { EvaluateFunc } from 'puppeteer';

const waitTillHTMLRendered = async (page, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while (checkCounts++ <= maxChecks) {
    const html = await page.content();
    const currentHTMLSize = html.length;

    const bodyHTMLSize = await page.evaluate(
      () => document.body.innerHTML.length,
    );

    console.log(
      'last: ',
      lastHTMLSize,
      ' <> curr: ',
      currentHTMLSize,
      ' body html size: ',
      bodyHTMLSize,
    );

    if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
      countStableSizeIterations++;
    else countStableSizeIterations = 0; //reset the counter

    if (countStableSizeIterations >= minStableSizeIterations) {
      console.log('Page rendered fully..');
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }
};
export async function createPDF(data, pdfPath) {
  const templateHtml = fs.readFileSync('./templates/final.html', 'utf8');
  // console.log('templateHtml', templateHtml);
  const template = handlebars.compile(templateHtml);
  const html = template(data);

  fs.writeFileSync(`./htmls/${pdfPath.split('/')[2]}.html`, html);

  const options = {
    width: 900 / 0.75,
    height: 700 / 0.75,
    scale: 1 / 0.75,
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
    `data:text/html;charset=UTF-8,${html}`,
    // `${html}`,
    { waitUntil: 'networkidle0' },
    // {
    //   waitUntil: 'networkidle0',
    // }
  );
  // await page.reload();
  // await autoScroll(page);
  // await page.waitForSelector('.certificate-images');
  // await page.waitForSelector('#communityPartner');
  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight);
  });
  // (async () => {
  //   await sleep(1000);
  // })();
  // await waitTillHTMLRendered(page);
  // await page.waitFor('*');
  // await page.waitForFunction('renderingCompleted === true');
  await page.pdf(options);

  await browser.close();
}

const sleep = (millisecondsCount) => {
  if (!millisecondsCount) {
    return;
  }
  return new Promise((resolve) =>
    setTimeout(resolve, millisecondsCount),
  ).catch();
};

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = 1024;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
