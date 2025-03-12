const puppeteer = require('puppeteer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');

function groupBy(array, keyExpression) {
  return array.reduce((group, item) => {
    const key = keyExpression(item);
    group[key] = group[key] ?? [];
    group[key].push(item);
    return group;
  }, {});
}

(async () => {
  /** 節目參數 */
  const gameId = '25_wubaitp';
  /** 尋找場次按鈕規則 */
  const gameLinkSelector = '#gameList tr:nth-child(1) button';
  /** 尋找區域按鈕規則 */
  const areaLinkSelector = '.area-list a';
  /** 尋找票種下拉選單規則 */
  const ticketPriceSelector = '#ticketPriceList tr:nth-child(1) select';
  /** 票種購買數量 */
  const ticketCount = 1;

  // 啟動 Puppeteer 並開啟瀏覽器
  //const browser = await puppeteer.launch({ headless: false }); // 設為 false 可看到瀏覽器操作

  // 使用指令開啟 Chrome (開啟後先手動登入讓它有 cookie)
  // "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222' // 連接本地的 Chrome 瀏覽器
  });

  // 取得現有的分頁
  //const pages = await browser.pages();
  //const page = pages[0];
  // 開啟新分頁
  const page = await browser.newPage();
  // 開啟 URL
  const url = `https://tixcraft.com/activity/game/${gameId}`;
  await page.goto(url, { waitUntil: 'networkidle2' });

  // 設定視窗大小
  await page.setViewport({ width: 1920, height: 919 });

  let alertHandler = null;
  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
    if (typeof alertHandler === 'function') {
      alertHandler();
      alertHandler = null;
    }
  });

  let hasArea = false;
  while (!hasArea) {
    // 選擇第一個場次
    let gameLink = await page.$(gameLinkSelector).catch(reason => {});
    while (!gameLink) {
      // 重新整理直到有場次出現
      await page.reload({ waitUntil: ["networkidle2"] });
      gameLink = await page.$(gameLinkSelector).catch(reason => {});
    }
    await gameLink.click();
    // 選擇第一個有剩餘的區域
    let areaLink = await page.$(areaLinkSelector).catch(reason => {});
    while (!areaLink) {
      // 重新整理直到有剩餘出現
      await page.reload({ waitUntil: ["networkidle2"] });
      areaLink = await page.$(areaLinkSelector).catch(reason => {});
    }
    // 點擊區域
    hasArea = await Promise.race([
      new Promise(resolve => alertHandler = resolve),
      (async () => {
        await areaLink.click();
        await page.waitForNavigation({ waitUntil: ["networkidle2"] });
        return true;
      })()
    ]);
    if (!hasArea) {
      console.log('沒有座位，重新選擇場次');
    }
  }

  let submitSuccess = false;
  while (!submitSuccess) {
    // 選擇購買數量
    const ticketSelect = await page.waitForSelector(ticketPriceSelector);
    await ticketSelect.select(String(ticketCount));
    // 找到驗證碼圖片的元素
    const captchaElement = await page.waitForSelector('#TicketForm_verifyCode-image');
    // 設定檢查驗證碼文字的規則
    const captchaRegex = /[a-z]{4}/;
    let captchaText = '';
    while (!captchaText) {
      // 設定額外辨識多少張驗證碼的圖片
      const captchaLength = 10;
      // 在原本的驗證碼圖片後面加入額外辨識的元素
      await page.evaluate(len => {
        const el = document.getElementById('TicketForm_verifyCode-image');
        const uid = crypto.randomUUID().substring(0, 6);
        for (let i = 0; i < len; i++) {
          el.insertAdjacentHTML('afterend', `<img id="TicketForm_verifyCode-image_${i}" src="https://tixcraft.com/ticket/captcha??u=${uid}.${i}">`);
        }
        // 等候新加入的圖片全部載入完成
        return new Promise((resolve) => {
          const images = el.parentElement.querySelectorAll('img');
          let loadedCount = 0;
          images.forEach(img => {
            if (img.complete) {
              loadedCount++;
            } else {
              img.onload = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                  resolve();
                }
              };
              img.onerror = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                  resolve();
                }
              };
            }
          });
          if (loadedCount === images.length) {
            resolve();
          }
        });
      }, captchaLength);
      // 把所有圖片的 Id 儲存起來
      const captchaIds = ['TicketForm_verifyCode-image'];
      for (let i = 0; i < captchaLength; i++) {
        captchaIds.push(`TicketForm_verifyCode-image_${i}`);
      }
      // 圖片的位置與大小資訊
      const images = await page.evaluate(selector => {
        return Array.from(document.querySelectorAll(selector)).map(img => {
          const { x, y, width, height } = img.getBoundingClientRect();
          return { x, y, width, height };
        });
      }, captchaIds.map(x => `#${x}`).join(', '));
      //console.log('images', images);
      // 整頁截圖
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      // 逐個處理每個圖片
      const recognizeArray = [];
      const recognizeTasks = images.map(async (img, index) => {
        // 使用 sharp 裁剪該圖片
        const captchaBuffer = await sharp(screenshotBuffer)
          .extract({ left: Math.round(img.x), top: Math.round(img.y), width: Math.round(img.width), height: Math.round(img.height) })
          .toBuffer();
        // 使用 Tesseract.js 辨識驗證碼
        const { data: { text: text } } = await Tesseract.recognize(captchaBuffer, 'eng', {
          // 設置參數讓辨識度提高
        });
        const text2 = (text?.toLowerCase().trim() ?? '').match(captchaRegex)?.[0];
        if (text2) {
          recognizeArray.push(text2);
        }
      });
      await Promise.all(recognizeTasks);
      console.log('recognizeArray', recognizeArray);
      // 根據相同文字的數量取得最多的一個文字
      captchaText = Object.entries(groupBy(recognizeArray, x => x)).sort(([aKey, aValues], [bKey, bValues]) => bValues.length - aValues.length)[0][0] || '';
      // 判斷是否有成功辨識到文字
      if (!captchaText) {
        console.log(`辨識驗證碼 ${captchaText} 失敗，重新獲取`);
        // 點擊驗證碼圖片重新載入
        captchaElement.click();
        // 清除由程式加入的驗證碼
        await page.evaluate(len => {
          for (let i = 0; i < len; i++) {
            document.getElementById(`TicketForm_verifyCode-image_${i}`).remove();
          }
        }, captchaLength);
      }
    }
    // 輸入驗證碼
    console.log('驗證碼', captchaText);
    await page.type('#TicketForm_verifyCode', captchaText);
    // 勾選同意會員服務條款
    await page.click('#TicketForm_agree');
    // 提交表單
    submitSuccess = await Promise.race([
      new Promise(resolve => alertHandler = resolve),
      (async () => {
        await page.click('[type="submit"]');
        // 跳轉到 https://tixcraft.com/ticket/checkout 才算成功
        await page.waitForRequest(request => request.url().includes('checkout'));
        return true;
      })()
    ]);
    if (!submitSuccess) {
      console.log('驗證碼錯誤，重新提交');
    }
  }
  console.log('已完成');
  // 關閉瀏覽器
  //await browser.close();
  process.exit(0);
})();
