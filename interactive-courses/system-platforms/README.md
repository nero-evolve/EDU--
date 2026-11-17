# 系統平臺探險隊

課程採「生活情境 → 概念說明 → worked example 示範 → 動手任務 → 回饋」的順序，包含分類、流程排序與機器人移動任務。答錯可重試；每次使用提示扣 2 分。

## 上線檔案

- 本資料夾：`index.html`、`style.css`、`course.js`
- 專案根目錄：更新後的 `cloud.js`
- 專案根目錄：新增的 `system-platforms-progress.sql`

學生與教師使用原有 Supabase 登入帳號和班級設定。系統平臺進度儲存在獨立的 `course_progress` 資料表，不會覆蓋位元探險隊的 `progress`。

## Supabase 設定

1. 在 Supabase SQL Editor 執行專案根目錄最新的 `system-platforms-progress.sql`。更新此功能時，請重新執行最新版。
2. 將本資料夾三個網站檔上傳到 GitHub 的 `interactive-courses/system-platforms/`。
3. 將更新後的 `cloud.js` 與新 SQL 檔上傳到 GitHub 專案根目錄。
4. 學生透過課程頁登入五位數班級座號；教師使用相同教師帳號。教師可以查看該班每人的分數、完成任務、提示數和作答明細。

如果 SQL 尚未執行，登入後進度仍會暫存在該學生目前使用的瀏覽器，但無法同步到其他裝置或教師後台。
