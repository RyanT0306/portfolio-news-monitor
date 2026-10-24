你要接手一個作品集專案：Portfolio News Monitor（澳股持股組合新聞監測器）。功能都已完成並公開在 GitHub，這一段對話的目標是**系統性地找出並修正 bug**。

專案位置：這個 repo 的根目錄（portfolio-news-monitor/）

請先完整讀過 docs/HANDOFF.md（特別是第 4 節評分邏輯、第 5 節環境、第 6 節「系統性除錯」清單、第 9 節工作習慣）與 docs/WORKFLOW.md。需要設計細節時再讀 docs/superpowers/specs/2026-10-21-portfolio-news-monitor-design.md。

讀完後請做這些事：
1. 用 `lsof -ti tcp:8000` 和 `lsof -ti tcp:5173` 確認前後端是否在執行。沒有的話照 HANDOFF.md 第 5 節啟動：後端用 Bash 背景執行 backend/.venv/bin/uvicorn，前端用 preview_start 的 "frontend" 設定。
2. 執行後端 pytest 和前端 npm test，確認目前全部通過，記下測試數量作為起點。
3. 用繁體中文向使用者簡短回報狀態，然後從 HANDOFF.md 第 6 節的除錯清單提出你建議的檢查順序，問使用者要從哪一區開始。

除錯方式：
- 一次處理一個問題：先重現 → 寫出會失敗的測試 → 修正 → 跑全部測試 → 能在瀏覽器看到的就實際操作確認。
- 每修好一個 bug 就單獨 commit，說明是什麼問題、怎麼修的。
- 找到的問題如果不打算馬上修，記到 HANDOFF.md 第 6 節。

重要提醒：
- 使用者用繁體中文溝通，網站介面是英文。說明要白話，給的指令要能直接貼上執行。
- 後端一律用 backend/.venv（Python 3.13）。系統 Python 3.15 跑不了 PyTorch。
- backend/.env 裡有 ANTHROPIC_API_KEY，絕對不要印出或複述。
- 沒有使用者同意前，不要改變評分公式的語意。
- repo 是公開的：commit 的檔案不要寫入本機絕對路徑或個人資訊。使用者說要上傳時才 git push。
