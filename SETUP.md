# 位元探險隊設定指南

## 更新已有 Supabase 專案

1. 保留 `cloud-config.js` 內現有的 Project URL 與 Publishable key；不可放入 Secret key。
2. 開啟 Supabase 專案 → SQL Editor，把本資料夾更新後的 `supabase.sql` 全文貼上並執行。這會新增三位數班級碼並更新教師建班及學生自動加入班級的資料庫函式；既有進度表不會刪除。
3. 到 Authentication → Sign In / Providers → Email，關閉 **Confirm email**。座號帳號使用系統內部建立的登入識別，不會寄送驗證信。
4. 把這個資料夾最新版本中的檔案（含 `index.html`、JS、CSS、`images/`）上傳到 GitHub repository 根目錄，提交後等 Pages 部署完成。

## 學生登入與班級

- 學生輸入 5 位數班級座號，例如 `90230`：前 3 碼 `902` 是班級碼，後 2 碼 `30` 是座號。
- 學生第一次輸入時會自動建立帳號，之後在任何電腦輸入相同座號即可取回進度。
- 教師須先在網站選「教師登入」，使用已開通的 Email 帳號登入。
- 在儀表板建立班級名稱及三位數班級碼，例如班級名稱「902 班」、班級碼「902」。學生座號須以這三碼開頭，登入後會自動加入對應班級。
- 原本透過邀請碼建立的舊班級沒有三位數班級碼。請用新班級碼建立班級，舊資料表和舊班級不會被刪除。

## 開通教師帳號

教師帳號不能自行取得 teacher 權限。先在 Supabase Authentication 建立教師 Email 帳號，再到 SQL Editor 執行下列指令，把 Email 換成教師帳號：

```sql
update public.profiles
set role = 'teacher'
where id = (select id from auth.users where email = 'teacher@example.edu');
```

重新登入後，該帳號會進入教師儀表板。

## 資料與登入方式說明

- 學生座號只作為識別碼，系統以座號衍生內部登入憑證，方便跨裝置取回資料；不會要求學生輸入 Email 或密碼。
- 依管理者選擇的免密碼方式，知道座號的人可能以該座號登入，因此不適合保存敏感個資或用作高風險正式測驗。
- 教師端只會列出該教師已建立班級中的學生；學生進度及評語保存在 Supabase。
- 舊版 Email 學生帳號及其進度不會自動轉成座號帳號；新座號首次登入會建立一筆新紀錄。舊資料仍留在資料庫原記錄中。
- 圖片素材目前仍沿用原專案檔案；如需替換，將另行加入新圖片並更新 `images/`。
