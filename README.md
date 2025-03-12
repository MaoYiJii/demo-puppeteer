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

找到程式中的這一行
``` js
const url = 'https://tixcraft.com/activity/game/25_wubaitp';
```
將 `25_wubaitp` 改成節目的參數

### 調整場次

找到程式中的這一行
``` js
await page.click('#gameList button');
```
根據自訂規則調整 selector
> 預設是點選第一個按鈕

### 調整區域

找到程式中的這一行
``` js
await page.click('.area-list a');
```
根據自訂規則調整 selector
> 預設是點選第一個有剩餘的區域

### 調整票種與票數

找到程式中的這一行
``` js
await page.select('#TicketForm_ticketPrice_01', '1');
```
- 第一個參數是對應第一個票種的下拉選單
- 第二個參數是該票種的數量
> 預設是選擇第一個票種一張