## 環境

安裝 [Node.js](https://nodejs.org/zh-tw/download)

## 前置作業

以 cmd 在專案的 `nodejs` 目錄下執行 `npm install`

## 運行

1. 以 cmd 開啟 chrome  
   *執行前先關閉 chrome 的所有視窗*
``` cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check --app https://tixcraft.com/
```
> 開啟後瀏覽 `http://localhost:9222/json/version` 檢查是否有成功串到偵錯的 port

2. 在 chrome 登入 [tixcraft](https://tixcraft.com/) (讓瀏覽器有 Cookie)

3. 以 cmd 在專案的 `nodejs` 目錄下執行 `npm run start`

## 調整參數

### 調整節目

開啟專案目錄下的 `nodejs\index.js`，修改這個參數
``` js
/** 節目參數 */
const gameId = '25_wubaitp';
```

### 調整場次

開啟專案目錄下的 `nodejs\index.js`，修改這個參數
``` js
/** 第幾場 (通常是選擇日期) */
const gameSeq = 1;
```
> 預設是第一場

### 調整區域 (票價)

開啟專案目錄下的 `nodejs\index.js`，修改這個參數
``` js
/** 票價優先權 (通常是選座位區域) */
const ticketPrices = [3800];
```
> 預設是先選 3800 票價，沒有才選其他票價

### 調整票種與票數

開啟專案目錄下的 `nodejs\index.js`，修改這個參數
``` js
/** 票種與數量 (總數不要大於 4) */
const tickets = [
  {
    /** 第一個票種 2 張 */
    seq: 1, count: 2
  }
];
```
> 預設是選擇第 1 個票種 2 張

以下範例是選擇 第 1 個票種 1 張，第 2 個票種 1 張
> seq (票種) 不要重複，count (票數) 總和不要超過 4
``` js
const tickets = [
  {
    seq: 1, count: 1
  },
  {
    seq: 2, count: 1
  }
];
```

## 開發參考資源

[Puppeteer](https://pptr.dev/)