# 教師申請審核與資料權限設定

## 執行前

1. 確認主資料庫已執行 `supabase.sql`、`system-platforms-progress.sql` 和 `teaching-materials.sql`。
2. 保持目前學生座號登入所需的 Supabase Email confirmation 設定，不要為了教師註冊而全站開啟驗證；這會影響學生第一次建立座號帳號。
3. 教師申請不會自行取得教師權限，只有管理者核准後才能管理班級與教材。可另外設定 Supabase Auth 的註冊頻率限制降低大量申請。

## 安裝審核與擁有者權限

1. 開啟 `teacher-approval-ownership.sql`。
2. 找到檔案中的 `REPLACE_WITH_SITE_OWNER_LOGIN_EMAIL`，替換成網站管理者目前使用的 Supabase Email 登入帳號。
3. 確認填入的是本人帳號，再於 Supabase SQL Editor 執行整份檔案。
4. 執行後，在網站「老師管理」登入管理者帳號，會看到教師帳號審核區。

申請者註冊後會先建立一般帳號和待審申請。管理者可核准或拒絕；只有核准後 `profiles.role` 才會改成 `teacher`，因此核准前不能建立班級或管理教材。審核時可把信箱驗證狀態當作參考。

## 權限效果

- 教師可檢視各班名單、學習進度，以及已發布或草稿教材。
- 只有班級建立者能移除該班學生；其他教師只能檢視並匯出成績。
- 所有核准教師可下載教材；只有上傳者能編輯或刪除教材和 Storage 檔案。
- 管理者可在「已核准教師管理」檢視教師及刪除帳號；若教師仍有班級、教材或評語，網站會阻止刪除，須先移轉或處理資料。
- 現有教師帳號與教材不會被刪除；舊教材依 `created_by` 保留原上傳者的編輯權。

## 部署教師帳號刪除功能

此功能必須使用 Supabase Edge Function 的管理端金鑰刪除 Auth 使用者，不能只上傳 GitHub Pages 檔案。

1. 將 `supabase/functions/delete-teacher/index.ts` 部署為 Supabase Edge Function，函式名稱使用 `delete-teacher`。可用 Supabase Dashboard 的 Edge Functions 編輯器建立並部署，或使用 Supabase CLI：`supabase functions deploy delete-teacher --project-ref 你的專案參照碼`。
2. 在 Edge Function 的環境變數中確認 Supabase 提供 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。管理端金鑰只能留在 Supabase，絕不可寫進網站檔案或 GitHub。
3. 執行最新版 `teacher-approval-ownership.sql`，建立待審申請清單與已核准教師清單 RPC。
4. 將網站根目錄的 `cloud.js`、`portal.js`、`portal.css`、`index.html` 一併部署至 GitHub Pages。

刪除只會處理沒有班級、教材與評語的教師帳號；有資料時會顯示數量並拒絕刪除，避免失去班級與教材的管理者。管理者帳號不會列入刪除清單。

如果 SQL Editor 中替換 Email 後仍沒有管理者審核區，請確認該 Email 已存在於 Supabase Auth，再重新執行檔案中的 `site_admins` 初始設定 INSERT。
