# Portfolio News Sentiment Monitor（澳股持股組合新聞監測器）— 設計與實作計畫

## Context

使用者想做一個**作品集／學習專題**：在網站上輸入自己的澳股持股（ASX 代號＋權重），貼上一則新聞，系統判斷這則新聞對「整個持股組合」是看好、中立還是看壞，並給出百分比與 0–100 分數，用 Stocktwits 風格的半圓儀表盤呈現。

重點是「能完整跑起來、畫面好看、評分邏輯講得清楚」。兩種判斷引擎並存、可切換、可並排比較，本身就是作品集的亮點。

參考來源：
- 視覺：Stocktwits Sentiment 儀表盤（refero.design）。五段半圓 Extremely bearish → Extremely bullish，指針加中央分數。配色 Dark Mint / Grapefruit / Silver / Night / Cotton，字型 Source Sans。
- 做法：`jordan5226/tw_stock_news_ai_monitor`。借用其嚴格 JSON schema、五級情緒、提示詞紀律（區分事實與推論、代號不確定不猜、一次性消息不誇大、不給目標價）、重點／期間／風險／信心等附加欄位、本機歷史與免責聲明。**不借用**自動爬新聞。

## 使用者決定的事項

| 項目 | 決定 |
|---|---|
| 用途 | 作品集／學習專題 |
| 判斷引擎 | Claude API 與 FinBERT **兩種都做、可切換** |
| 市場 | 澳股（ASX），新聞以英文為主 |
| 介面語言 | 英文 |
| 無關持股 | **排除不算**，相關持股的權重重新分配，另外顯示「影響你 X% 的持股」 |
| 版面 | 儀表盤＋明細（mockup C）：左側輸入、右側儀表盤與逐檔明細 |
| API key | 目前沒有，所以沒有 key 時網站也必須能完整使用 FinBERT 模式 |
| 部署 | 先在本機執行 |

## 目標／非目標／反目標

- **目標**：貼新聞後約 10 秒內得到整體判斷（Claude 模式）。FinBERT 模式完全免費、可離線使用。評分公式透明，畫面上可以看到「怎麼算出來的」。README 達到可以放進作品集的品質。
- **非目標（v1 不做）**：自動爬新聞、貼網址抓文章、使用者帳號、雲端部署、即時股價。
- **反目標**：結果看起來像投資建議或喊單（必須有免責聲明，不給目標價）；FinBERT 對沒提到的公司亂套情緒；把 LLM 回傳的數字未經驗證就直接顯示。

## 技術選擇（我的決定）

- **後端**：Python 3.11+、FastAPI、Pydantic v2、`anthropic` SDK、`transformers`＋`torch`（CPU）。理由是 FinBERT 只能在 Python 上跑。
- **前端**：Vite＋React＋TypeScript。儀表盤手寫 SVG，不依賴圖表庫，作品集上能展示自己的實作。
- **測試**：後端用 pytest，引擎一律 mock，測試不下載模型也不呼叫 API；前端用 Vitest 測儀表盤的角度與分區計算。
- **位置**：新資料夾 `portfolio-news-monitor/`，自己是一個獨立的 git repo。

## 核心評分邏輯（`backend/app/aggregate.py`，純函式，重點測試對象）

每個引擎對每一檔持股回傳 `HoldingSentiment { ticker, relevant, bullish, neutral, bearish (0–1, 總和=1), reason?, confidence? }`。

1. 權重正規化：使用者輸入的權重總和若不是 100，就先按比例縮放，前端顯示提醒。
2. `related = [h for h in holdings if h.relevant]`；若為空，回傳 `status="unrelated"`，畫面顯示「This news doesn't relate to your holdings」。
3. 重新分配權重：`w_i' = w_i / Σ_related w`。
4. 組合機率：`P_k = Σ w_i' · p_i,k`，其中 k ∈ {bullish, neutral, bearish}。
5. 分數：`score = round(50 + 50 · (P_bull − P_bear))`，範圍 0–100。每一檔持股也用同一公式算出個別分數。
6. 五段標籤：`<20` Strongly bearish、`20–39` Bearish、`40–60` Neutral、`61–80` Bullish、`>80` Strongly bullish。
7. 曝險：`exposure = Σ_related w / Σ_all w`，例如顯示「Affects 40% of your portfolio」。
8. 結論 = 分數所在的區段；同時顯示三個百分比。

## 兩種引擎

共同介面 `engines/base.py`：`async analyze(news: str, holdings: list[ResolvedHolding]) -> EngineResult`，其中 `EngineResult` 包含 `per_holding`，以及選填的 `summary`、`key_points`、`time_horizon`、`risks`、`watch_items`。

### Claude 引擎（`engines/claude_engine.py`）
- 模型：`claude-opus-5-5`（依 claude-api skill 的預設），可用環境變數 `CLAUDE_MODEL` 覆蓋。`output_config={"effort": "low"}`，因為這是分類任務。
- 結構化輸出：使用 `client.messages.parse(output_format=PydanticModel)`，參照 claude-api skill `python/claude-api/tool-use.md` 的「JSON Outputs」段落。依 skill 建議預設開啟 server-side refusal fallback（`fallbacks: "default"`＋beta `server-side-fallback-2026-07-01`）；實作時要確認它能和 `parse` 搭配，不能的話改用 `client.beta.messages.create` 加上 `output_config.format` json_schema，再自行用 Pydantic 驗證。要處理 `stop_reason == "refusal"`。
- Schema（每檔持股）：`ticker`、`relevant: bool`、`bullish/neutral/bearish: int 0–100`、`reason: str`（一句話）、`confidence: int 0–100`。整體欄位：`summary`、`key_points[]`、`time_horizon[]`（short/medium/long）、`risks[]`、`watch_items[]`。
- 收到結果後由後端把三個機率正規化成總和 1，並確認 ticker 都在輸入清單內，多出來的丟掉、缺的視為 not relevant。
- System prompt 借用參考專案的紀律：區分事實與推論；間接影響（供應鏈、原物料、利率、匯率、同業競爭）也算相關，但要寫出理由；不確定就 `relevant=false`；一次性消息不誇大；不給目標價或買賣建議；輸出英文。
- 沒有 `ANTHROPIC_API_KEY` 時，`/api/health` 回報 `claude: unavailable`，前端點選 Claude 會顯示設定說明（按鈕不禁用）。

### FinBERT 引擎（`engines/finbert_engine.py`）
- 模型 `ProsusAI/finbert`，使用 `transformers` pipeline、`top_k=None` 取得三類機率。第一次呼叫時才載入（約 440MB，首次需下載），之後常駐記憶體。
- **只對有提到該公司的句子做判斷**：先斷句，再找出提到該持股的句子（ticker 完整大寫比對，或公司名稱／別名不分大小寫比對），對這些句子跑 FinBERT 後取平均機率。沒被提到的持股就標記 `relevant=false`。
- `reason` 欄位填入命中的句子摘錄（最多 2 句），讓使用者知道依據是哪一句。
- 限制寫進 README 並在畫面上提示：看不出間接影響，例如「鐵礦砂跌價」而沒有點名 BHP 時會判為無關。這正是和 Claude 模式對比的重點。

### 比較模式
前端可以同時勾選兩個引擎，後端用 `asyncio.gather` 平行執行，畫面並排顯示兩個分數，與 mockup C 右上角相同。

## ASX 股票資料（`backend/app/asx.py`＋`backend/data/asx_companies.csv`）
- 內建 CSV，欄位為 `ticker,name,aliases`（aliases 以 `|` 分隔，例如 `CBA,Commonwealth Bank of Australia,CommBank|Commonwealth Bank`）。範圍至少涵蓋 ASX 200。附 `scripts/build_asx_list.py` 從 ASX 官方上市公司清單產生，抓不到時改用手動整理的 ASX 200 名單（實作者自行判斷）。
- 比對名稱前先去掉 `Limited / Ltd / Group / Holdings` 等後綴。
- `GET /api/tickers?q=` 提供前端自動完成。不在清單內的代號也允許輸入，但會提示 FinBERT 只能比對代號本身。

## API

- `GET /api/health` → `{ engines: { claude: "ready"|"unavailable", finbert: "ready"|"not_loaded" } }`
- `GET /api/tickers?q=bh` → `[{ticker, name}]`
- `POST /api/analyze` → body `{ holdings: [{ticker, weight}], news: str (50–20000 字元), engines: ["claude","finbert"] }`；回傳每個引擎各自的 `{ status, score, label, bullish, neutral, bearish, exposure, holdings: [...], summary?, key_points?, ... , error? }`。單一引擎失敗不影響另一個。

## 前端（`frontend/src/`）

元件：`HoldingsEditor`（代號自動完成、權重輸入、總和提示）、`NewsInput`（textarea 與字數）、`EngineToggle`、`SentimentGauge`（SVG 五段半圓、指針動畫、中央分數）、`ResultPanel`（三個百分比、曝險、Claude 的 summary／key points／risks）、`HoldingBreakdown`（每檔三色橫條、理由、無關持股灰顯）、`HowItsScored`（可展開的公式說明）、`HistoryList`。

- 版面依 mockup C：桌面版左窄右寬兩欄，手機版改成單欄。
- 配色以 CSS 變數定義，支援亮色與暗色（Night 作為暗色背景）：Grapefruit 紅代表看壞、Dark Mint 綠代表看好、Silver 灰代表中立。字型 Source Sans 3（Google Fonts）。
- localStorage 記住持股，並保存最近 20 筆分析紀錄（新聞前 80 字、分數、時間）。所有存取包 try/catch。
- 頁尾放免責聲明「For research and education only. Not investment advice.」。
- 內建 2–3 則範例新聞（Load example），讓人不用找新聞也能立刻試用，對作品集展示很重要。

## 專案結構

```
portfolio-news-monitor/
├─ backend/  app/{main.py, models.py, aggregate.py, asx.py, engines/{base,claude_engine,finbert_engine}.py}
│            data/asx_companies.csv  scripts/build_asx_list.py  tests/  pyproject.toml  .env.example
├─ frontend/ src/{components/, lib/{api.ts, gauge.ts, storage.ts}, App.tsx}  vite.config.ts（代理 /api → :8000）
├─ docs/superpowers/specs/2026-10-21-portfolio-news-monitor-design.md（本計畫的設計部分）
├─ docker-compose.yml（選用，後端＋前端）
└─ README.md（截圖、架構圖、評分公式、兩種引擎的比較、如何取得 Claude API key）
```

## 實作順序（TDD：先寫測試再實作）

1. 建立資料夾、`git init`、將設計文件存入 `docs/superpowers/specs/`
2. 後端骨架與 Pydantic models
3. `aggregate.py` 與完整單元測試（權重正規化、排除無關持股、全部無關、分數邊界 20/40/60/80、機率總和）
4. ASX 資料、`asx.py` 名稱比對與測試
5. FinBERT 引擎：斷句、找出提到該持股的句子並平均機率（mock pipeline 測試）
6. Claude 引擎：schema、prompt、結果正規化、refusal 與錯誤處理（mock client 測試）
7. FastAPI 路由、比較模式平行執行、API 測試（TestClient）
8. 前端骨架、主題色、API client
9. `SentimentGauge`（含 Vitest 角度與分區測試）、結果與明細元件
10. 持股編輯器、範例新聞、歷史紀錄
11. README、`.env.example`、docker-compose
12. 端到端驗證

## 驗證方式

- `cd backend && pytest`：全部通過（不需網路與 API key）。
- `cd frontend && npm test && npm run build`：通過。
- 本機執行 `uvicorn app.main:app --reload` 與 `npm run dev`，用內建瀏覽器打開，測試以下情境：
  1. 沒有 API key 時，FinBERT 模式：持股 BHP 40／CBA 30／CSL 30，貼上點名 BHP 的負面新聞，應得到看壞、曝險 40%，CBA 與 CSL 灰顯。
  2. 貼上完全無關的新聞，應顯示「unrelated」。
  3. 權重總和 90 時，應顯示提醒並自動正規化。
  4. 手機寬度與暗色模式下版面正常。
  5. 若之後取得 API key，再測 Claude 模式與並排比較，例如「鐵礦砂跌價」沒點名 BHP 時，Claude 判為相關，FinBERT 判為無關。
- 截圖放進 README。

## 留給實作者自行判斷

ASX 清單的取得方式、斷句工具（regex 或 nltk）、儀表盤動畫細節、Claude 兩次回傳格式失敗時的重試次數（建議 1 次）。
