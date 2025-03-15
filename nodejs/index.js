const puppeteer = require('puppeteer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');

/** 節目參數 */
const gameId = '25_wubaitp';
/** 第幾場 (通常是選擇日期) */
const gameSeq = 1;
/** 票價優先權 (通常是選座位區域) */
const ticketPrices = [3800, 3200];
/** 票種與數量 (總數不要大於 4) */
const tickets = [
  {
    /** 第一個票種 2 張 */
    seq: 1, count: 2
  }
];
/** 額外驗證頁面
 * - 信用卡卡友填入信用卡號碼前 8 碼
 * - 額外規定確認填入 'YES' */
const verifyCode = 'YES';



/** 票種購買數量 (從票種與數量加總，不要手動設定) */
const ticketCount = tickets.map(x => x.count).reduce((a, b) => a + b, 0);

function groupBy(array, keyExpression) {
  return array.reduce((group, item) => {
    const key = keyExpression(item);
    group[key] = group[key] ?? [];
    group[key].push(item);
    return group;
  }, {});
}

(async () => {
  const args = process.argv.slice(2);
  console.log('args', args);

  // 啟動 Puppeteer 並開啟瀏覽器
  //const browser = await puppeteer.launch({ headless: false }); // 設為 false 可看到瀏覽器操作

  // 使用指令開啟 Chrome (開啟後先手動登入讓它有 cookie)
  // "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222' // 連接本地的 Chrome 瀏覽器
  });

  // 開啟新分頁
  const page = await browser.newPage();
  // 設定視窗大小
  await page.setViewport({ width: 1920, height: 919 });
  // 點掉所有 alert
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') {
      await dialog.accept();
    }
    else {
      await dialog.dismiss();
    }
  });

  // 以參數作為進入點
  if (args[0]) {
    await page.goto(args[0], { waitUntil: 'networkidle0' });
  }

  await resolvePage();

  async function resolvePage() {
    let catchCount = 0;
    while (true) {
      try {
        const url = page.url();
        if (url.includes(`/activity/detail/${gameId}`)) {
          await resolveDetail();
        }
        else if (url.includes(`/activity/game/${gameId}`)) {
          await resolveGame();
        }
        else if (url.includes(`/ticket/area/${gameId}`)) {
          await resolveArea();
        }
        else if (url.includes(`/ticket/verify/${gameId}`)) {
          await resolveVerify();
        }
        else if (url.includes(`/ticket/ticket/${gameId}`)) {
          await resolveTicket();
        }
        else if (url.includes(`/ticket/order`)) {
          await resolveOrder();
        }
        else if (url.includes(`/ticket/checkout`)) {
          await resolveCheckout();
        }
        else {
          // 開啟 URL (如果有給執行參數，以參數為進入點)
          await page.goto(args[0] || `https://tixcraft.com/activity/game/${gameId}`, { waitUntil: 'networkidle0' });
        }
        catchCount = 0;
      }
      catch (ex) {
        console.error(ex);
        catchCount++;
        if (catchCount >= 3) {
          // 錯誤 3 次重頭開始跑
          await page.goto(`https://tixcraft.com/activity/game/${gameId}`, { waitUntil: 'networkidle0' });
        }
      }
    }
  }

  /** 節目介紹
   * /activity/detail/25_wubaitp */
  async function resolveDetail() {
    // 跳轉到選擇場次
    await page.goto(`https://tixcraft.com/activity/game/${gameId}`, { waitUntil: 'networkidle0' });
  }

  /** 選擇場次
   * /activity/game/25_wubaitp */
  async function resolveGame() {
    const selector = `#gameList tr:nth-child(${gameSeq}) button`;
    // 選擇第一個場次
    let link = await page.$(selector);
    while (!link) {
      // 重新整理直到有場次出現
      console.log('沒有可選擇場次，重新整理');
      await page.reload({ timeout: 3000 });
      link = await page.$(selector);
    }
    await link.click();
    await page.waitForNavigation({ timeout: 3000 });
  }

  /** 選擇區域 (票價)
   * /ticket/area/25_wubaitp */
  async function resolveArea() {
    // 過濾區域邏輯
    async function getAreaLink() {
      /** 備選 */
      const alternatives = [];
      const links = await page.$$('.area-list a');
      for (const link of links) {
        const price = await page.evaluate((link, ticketCount) => {
          // 獲取剩餘數量
          const remainingReg = /剩餘\s*(\d+)/;
          const remainingMatch = link.innerText.match(remainingReg);
          if (remainingMatch) {
            const remaining = Number(remainingMatch[1].replaceAll(',', ''));
            if (remaining < ticketCount) {
              // 沒有空位，回傳 -1
              return -1;
            }
            const priceReg = /[\d,]{3,}/g;
            const priceMatch = link.innerText.replace(remainingMatch[1], '').match(priceReg);
            if (priceMatch) {
              return Number(priceMatch[0].replaceAll(',', ''));
            }
            // 無法獲取確切票價
            return 0;
          }
        }, link, ticketCount);
        if (price !== -1) {
          if (String(price) === String(ticketPrices[0])) {
            // 如果有符合第一志願的票價，就直接點了
            return link;
          }
          alternatives.push({
            price: price,
            link: link
          });
        }
      }
      // 根據票價設定取得靠前的優先度
      const pricesReverse = ticketPrices.reverse();
      return alternatives.sort((a, b) => pricesReverse.indexOf(b.price) - pricesReverse.indexOf(a.price))[0].link;
    }
    // 選擇區域
    let link = await getAreaLink();
    while (!link) {
      // 重新整理直到有剩餘出現
      console.log('沒有可選擇區域，重新整理');
      await page.reload({ timeout: 3000 });
      link = await getAreaLink();
    }
    await link.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 });
  }

  /** 信用卡專區 輸入卡號頁面
   * /ticket/verify/25_wubaitp */
  async function resolveVerify() {
    await page.type('[name="checkCode"]', verifyCode);
    await page.click('[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 });
  }

  /** 選擇票種與數量
   * /ticket/ticket/25_wubaitp */
  async function resolveTicket() {
    let applyCountTotal = 0;
    for (let ticket of tickets.filter(x => x.seq > 1)) {
      const applyCount = 0;
      const select = await page.$(`#ticketPriceList tr:nth-child(${ticket.seq}) select`);
      if (select) {
        const remaining = await page.evaluate(select => Number(select.querySelector('option:last-child').value), select);
        applyCount = Math.min(ticket.count, remaining);
        await ticketSelect.select(String(applyCount));
      }
      applyCountTotal += applyCount;
    }
    const defaultSelect = await page.$('#ticketPriceList tr:nth-child(1) select');
    const defaultCount = ticketCount - applyCountTotal;
    if (defaultSelect && await page.evaluate((select, targetValue) => Array.from(select.options).some(option => option.value === targetValue), defaultSelect, String(defaultCount))) {
      await defaultSelect.select(String(defaultCount));
    }
    else {
      // 票數不足，重新選擇
      console.log('票數不足，重新選擇');
      const buttonReselect = await page.$('#reSelect');
      if (buttonReselect) {
        await buttonReselect.click();
      }
      else {
        // 如果沒有區域可以選擇的節目，會沒有重新選擇按鈕，手動會到場次列表
        await page.goto(`https://tixcraft.com/activity/game/${gameId}`, { waitUntil: 'networkidle0' });
      }
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 });
      return;
    }
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
    await page.click('[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 });
  }

  /** 轉圈圈
   * /ticket/order */
  async function resolveOrder() {
    await page.waitForRequest(request => {
      const url = request.url();
      return url.includes('/ticket/checkout') || url.includes(`/ticket/verify/${gameId}`);
    });
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 });
  }

  /** 付款
   * /ticket/checkout */
  async function resolveCheckout() {
    console.log('已完成');
    process.exit(0);
  }
})();