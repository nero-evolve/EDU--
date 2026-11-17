# 位元探險隊

本資料夾集中放置位元數字系統互動課程的頁面和課程程式：

- `index.html`：課程入口頁
- `app.js`：學生任務、教師介面與課程呈現
- `content.js`：各章課文、題目和提示
- `engine.js`：答題、進度與分數邏輯
- `visuals.js`：課程圖解
- `course.css`：課程樣式

課程網址為 `interactive-courses/bit-explorers/`。根目錄的 `bit-explorers.html` 保留為舊網址轉址頁，讓既有書籤繼續可用。

`cloud.js`、`cloud-config.js` 和 Supabase SQL 留在網站根目錄，因為教材入口與課程共用雲端服務；課程程式會透過相對路徑載入根目錄的共用連線。
