# 雲端班級版設定

## 專案架構

- `content.js`：課程步驟、題目、個人化題目產生。
- `engine.js`：作答狀態、判分、計時、提示與分數計算；仍在瀏覽器執行。
- `app.js`：學生課程畫面、登入入口、教師儀表板及操作事件。
- `cloud.js`：Supabase Auth 與資料庫存取。
- `supabase.sql`：帳號資料、班級、進度、教師評語、排行榜 RPC 與資料列安全規則。

## 建立雲端服務

1. 建立 Supabase 專案，於 SQL Editor 執行本資料夾的 `supabase.sql`。
2. 在 Authentication 設定 Email 登入。啟用確認信時，學生先驗證再登入，之後可在學生頁面輸入班級代碼加入；關閉確認信時，註冊畫面填入代碼即可加入。
3. 到 Project Settings → API，複製 Project URL 與 `anon` / publishable key，填入 `cloud-config.js`。切勿使用 `service_role` key。
4. 將整個資料夾部署到支援 ES modules 的 HTTPS 靜態網站（如 GitHub Pages）。Supabase Authentication 的 Site URL / Redirect URLs 設成網站網址。
5. 教師先透過登入畫面建立帳號，再在 Supabase SQL Editor 將該帳號提升為教師：

   ```sql
   update public.profiles
   set role = 'teacher'
   where id = (select id from auth.users where email = 'teacher@example.edu');
   ```

   登出再登入後，教師可建立班級並提供邀請代碼。學生註冊時輸入代碼；已有帳號者目前需在首次註冊時輸入代碼。

## 功能與資料流

- 學生以 Email / 密碼註冊登入。班級代碼加入班級；進度在每個課程事件後保存到 `progress`，登入其他電腦會載入雲端最後一份進度。
- 排行依目前分數排序，同分依最近更新時間排序。排行榜只對同班成員開放。
- 教師可建立多個班級、檢視學生進度與分數，並儲存每位學生的班級評語；學生登入後會看到評語。
- 教師角色由管理者提升，註冊資料不能自行選擇 teacher。資料列安全政策限制學生只能讀寫自己的進度，教師只可檢視自己班級成員資料。
- 重新開始會刪除本機及雲端進度；重刷沿用既有課程規則。

## 目前版本限制

- 使用 Supabase Auth Email / 密碼，未加上忘記密碼流程、學校單一登入或批次匯入學生帳號。
- 本機原有進度不會自動匯入帳號；學生登入後第一次作答才會建立雲端進度。
- 判分仍在瀏覽器端執行；排行榜適合課堂進度與練習回饋，不應當作防作弊的正式成績系統。若要作為正式評量，需將判分和事件驗證搬到受信任的伺服器端。
- `supabase.sql` 的 `join_class` 可在註冊確認信啟用或關閉時加入班級；驗證信模式下，學生需登入後於學生頁面輸入班級代碼。
- 此為靜態前端加 Supabase 後端服務；Supabase 專案 URL、key、SQL migration 與網站網址仍需部署者設定，本壓縮檔沒有任何既有雲端帳密。
