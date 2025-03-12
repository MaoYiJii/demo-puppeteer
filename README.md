## 環境

安裝 [Node.js](https://nodejs.org/zh-tw/download)

## 前置作業

以 cmd 在專案的 `nodejs` 目錄下執行 `npm install`

## 運行

1. 以 cmd 開啟 chrome
``` cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check
```

2. 在 chrome 登入 [tixcraft](https://tixcraft.com/) (讓瀏覽器有 Cookie)

3. 以 cmd 在專案的 `nodejs` 目錄下執行 `npm run start`

## 調整參數

### 調整節目

在程式中修改這個參數
``` js
/** 節目參數 */
const gameId = '25_wubaitp';
```

### 調整場次

在程式中修改這個參數
``` js
/** 尋找場次按鈕規則 */
const gameLinkSelector = '#gameList tr:nth-child(1) button';
```
> 預設是點選第一個按鈕

### 調整區域

在程式中修改這個參數
``` js
/** 尋找區域按鈕規則 */
const areaLinkSelector = '.area-list a';
```
> 預設是點選第一個有剩餘的區域

### 調整票種與票數

在程式中修改這 2 個參數
``` js
/** 尋找票種下拉選單規則 */
const ticketPriceSelector = '#ticketPriceList tr:nth-child(1) select';
/** 票種購買數量 */
const ticketCount = 1;
```
- 第 1 個參數是對應第一個票種的下拉選單
- 第 2 個參數是該票種的數量
> 預設是選擇第一個票種一張

## 開發參考資源

[Puppeteer](https://pptr.dev/)