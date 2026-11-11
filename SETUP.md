# 位元探險隊設定指南

## 更新已有 Supabase 專案

1. 保留 `cloud-config.js` 內現有的 Project URL 與 Publishable key；不可放入 Secret key。
2. 若目前專案已能讓學生用座號登入並在教師儀表板看到名單，保留既有資料庫設定。這次新增「老師核定分數」與逐題作答紀錄檢視，請在部署新版前，於 Supabase → SQL Editor 執行 `teacher-score-overrides.sql`。不要重跑整份 `supabase.sql`，以免碰觸現有設定。若舊專案還沒有班級碼登入功能，才先依原設定指南安裝 `supabase.sql`。
3. 到 Authentication → Sign In / Providers → Email，關閉 **Confirm email**。座號帳號使用系統內部建立的登入識別，不會寄送驗證信。
4. 把最新版本的網站檔案（含 `index.html`、所有 JS、CSS）上傳到 GitHub repository 根目錄，提交後等 Pages 部署完成。下面的「部署到 GitHub Pages」有詳細步驟。

### 清除測試班級（選用）

如果這個 Supabase 專案只放了測試資料，而且你想用相同班級碼重新建班，可在 SQL Editor 檢查並執行 `reset-trial-data.sql`。它會刪除所有班級、班級成員、學習進度和教師評語，但保留教師與學生的 Supabase 登入帳號。執行後無法復原被刪除的資料。

## 學生登入與班級

- 學生輸入 5 位數班級座號，例如 `90230`：前 3 碼 `902` 是班級碼，後 2 碼 `30` 是座號。
- 學生第一次輸入時會自動建立帳號，之後在任何電腦輸入相同座號即可取回進度。
- 教師須先在網站選「教師登入」，使用已開通的 Email 帳號登入。
- 在儀表板建立班級名稱及三位數班級碼，例如班級名稱「902 班」、班級碼「902」。學生座號須以這三碼開頭，登入後會自動加入對應班級。
- 原本透過邀請碼建立的舊班級沒有三位數班級碼。可另建新班級；如果測試班級占用了要用的班級碼，參考上方的選用重設步驟。
- 新版分階段課程會為學生建立新的學習進度；舊版課程的測試進度不會轉成新課程步驟。學生第一次進入新版會從第 1 章開始；之後可用章節選單自由練習。直接跳章不會增加完成度，完成各章檢核才會計入該章分數。

## 開通教師帳號

教師帳號不能自行取得 teacher 權限。先在 Supabase Authentication 建立教師 Email 帳號，再到 SQL Editor 執行下列指令，把 Email 換成教師帳號：

```sql
update public.profiles
set role = 'teacher'
where id = (select id from auth.users where email = 'teacher@example.edu');
```

重新登入後，該帳號會進入教師儀表板。

## 資料與登入方式說明

- 學生座號只作為識別碼，系統以座號衍生內部登入憑證；不會要求學生輸入 Email 或密碼。
- 依管理者選擇的免密碼方式，知道座號的人可能以該座號登入，因此不適合保存敏感個資或用作高風險正式測驗。
- 教師端只會列出該教師已建立班級中的學生；每次作答、提示、目前步驟和學習進度都會同步到 Supabase。教師可展開作答紀錄查看逐題答案，並儲存 0–100 的「老師核定分數」；留空並儲存會回復系統檢核分數。
- 新版課程的教學圖解由 `visuals.js` 以 SVG 繪製；原 `images/` 資料夾中的圖片不會用於新版課程畫面。
- 章末檢核分數由六關檢核題平均計算。練習答錯、使用提示與重試都不扣分；老師仍可查看完成度、檢核分數和評語。

## 部署到 GitHub Pages

1. 先確認 `cloud-config.js` 使用的是 Supabase Project URL 和 Publishable/anon key，不可放 Secret/service-role key。
2. 先在 Supabase SQL Editor 執行 `teacher-score-overrides.sql`，完成教師核定分數資料表與權限設定。
3. 開啟你的 GitHub 專案 `nero-evolve/EDU--`，選 Code → Add file → Upload files。
4. 將本資料夾中的網站檔案上傳至 repository 根目錄，保留 `index.html` 在根目錄；若 GitHub 詢問同名檔案覆蓋，確認後提交變更。不要把整個資料夾再包一層上傳。
5. 在 Commit changes 提交到 `main`。接著選 Actions，查看最新的 `pages build and deployment` 工作流程；出現綠色勾勾後，開啟 Settings → Pages 顯示的網址。
6. 老師先登入網站建立三位數班級碼，再讓學生輸入五位數座號，例如 90230。教師後台可查看進度、逐題作答、系統分數，並編輯老師核定分數。

如果 GitHub Actions 顯示佇列或部署失敗，先點最新 workflow 查看錯誤；只有綠色成功狀態才代表新版本已上線。部署後用 Ctrl+F5 更新快取。
