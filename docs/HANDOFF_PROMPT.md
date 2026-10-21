你要接手一個已經完成並驗證過的作品集專案：Portfolio News Monitor（澳股持股組合新聞監測器）。

專案位置：這個 repo 的根目錄（portfolio-news-monitor/）

請先完整讀過 docs/HANDOFF.md，裡面有專案目的、目前狀態、架構、評分邏輯、環境注意事項、已知問題與使用者偏好。需要更多設計細節時再讀 docs/superpowers/specs/2026-10-21-portfolio-news-monitor-design.md。

讀完後請做這些事：
1. 用 `lsof -ti tcp:8000` 和 `lsof -ti tcp:5173` 確認前後端是否還在執行。沒有在執行的話，照 HANDOFF.md 第 5 節的方式啟動：後端用 Bash 背景執行 backend/.venv/bin/uvicorn，前端用 preview_start 的 "frontend" 設定。
2. 執行後端 pytest 和前端 npm test，確認全部通過。
3. 用繁體中文向使用者簡短回報目前狀態，並從 HANDOFF.md 第 6 節挑出你建議的下一步，問使用者想做哪一項。

重要提醒：
- 使用者用繁體中文溝通，網站介面是英文。說明要白話，給的指令要能直接貼上執行。
- 後端一律用 backend/.venv（Python 3.13）。系統 Python 3.15 跑不了 PyTorch。
- backend/.env 裡有使用者的 ANTHROPIC_API_KEY，絕對不要印出或複述。
- 沒有使用者同意前，不要改變評分公式的語意。
