# 讀心術師卡爾｜二進位與資料數位化

以讀心卡片帶學生認識二進位、文字、圖片與聲音的互動課程。原課程採純靜態網頁與本機進度；此版本新增 Supabase 帳號、跨裝置同步、班級排行、教師儀表板與教師評語。

## 功能

- 學生以 Email／密碼登入，雲端保存課程作答進度，換電腦登入可繼續。
- 教師帳號由管理者提升，可建立班級、查看學生進度與分數、留下個別評語。
- 學生加入班級後可看同班排行與教師評語。
- 原有題目、提示、計時與計分規則保留。

## 部署

請依 [SETUP.md](./SETUP.md) 建立 Supabase 專案、執行 [supabase.sql](./supabase.sql)、填入 `cloud-config.js`，再將資料夾部署至 HTTPS 靜態網站。前端只使用 Supabase anon/publishable key；不可放入 service-role key。

## 程式架構

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 頁面外框 |
| `app.js` | 學生課程、登入、班級排行與教師儀表板 |
| `engine.js` | 題目事件、判分、提示、計時與計分規則 |
| `content.js` | 課程內容與題目 |
| `cloud.js` | Supabase Auth、進度、班級與評語 API |
| `cloud-config.js` | Supabase URL 與公開 anon key |
| `supabase.sql` | 資料表、RPC 與列層級權限政策 |
| `course.css` | 課程版面與樣式 |

## 授權

- 程式碼：MIT，見 `LICENSE`。
- 課程內容與插圖：CC BY-NC-SA 4.0，見 `LICENSE-CONTENT.md`。

© 2026 KUSU 酷書
