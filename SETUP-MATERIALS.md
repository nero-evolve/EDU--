# 教材入口網站設定

## 這版包含什麼

- 網站首頁 `index.html` 是教材入口，學生可以選七、八、九年級、搜尋教材並下載已發布的學生教材。
- 老師點「老師管理」後，用現有的教師 Email 和密碼登入，可以上傳、編輯教材資訊、替換檔案、下載或刪除教材。
- 舊的位元探險隊課程保存在 `bit-explorers.html`；課程內可點「教材首頁」返回入口。
- 學生瀏覽與下載學生教材不需要登入。教師限定檔案與未發布的草稿放在私有儲存空間，只有教師可檢視。

## Supabase 設定（執行一次）

1. 開啟 Supabase 專案 → **SQL Editor** → **New query**。
2. 開啟本資料夾中的 `teaching-materials.sql`，全選複製到 SQL Editor，按 **Run**。
3. 確認結果顯示成功。這會建立教材資料表、兩個 Storage buckets 和教師權限政策；不需要重跑 `supabase.sql`。

## 發布到 GitHub Pages

將本資料夾根目錄的網站檔案上傳至 GitHub repository 根目錄，提交到 `main`。至少包含：

- 新入口：`index.html`、`portal.css`、`portal.js`
- 舊課程入口：`bit-explorers.html`
- 原有課程檔案：`app.js`、`cloud.js`、`cloud-config.js`、`course.css`、`content.js`、`engine.js`、`visuals.js`、`images/` 等
- 授權與設定文件

同名檔案請選擇覆蓋；不要額外包一層資料夾。Actions 的 Pages workflow 顯示綠色勾勾後，打開網站首頁即可看到教材入口。

## 使用與檔案可見性

- 老師端登入會檢查 Supabase `profiles.role` 是否為 `teacher`；學生帳號不能進入教材管理。
- 標為「學生可檢視與下載」且勾選發布的檔案會放在公開 bucket，任何取得該檔案網址的人都能下載。請只放適合提供給學生的教材，不要放學生個資或答案密碼。
- 老師限定教材和草稿存在私有 bucket，學生端不會顯示，也沒有下載權限。
- 若要把教材改成老師限定、改回學生可下載，或把已發布教材改為草稿，編輯時必須重新選取檔案，系統會將檔案移到相符的公開／私有空間。
- SQL migration 將單檔限制設為 50 MB；實際可用上限仍受 Supabase 專案方案與 Storage 設定限制。較大的影片可改放學校核准的影音服務，再把連結放入教材說明。

## 下一步

Supabase SQL 完成後，先登入老師端上傳一份可公開的測試 PDF，確認學生端能看到和下載；再測試老師限定檔案不會出現在學生列表。確認後再上傳正式教材。
