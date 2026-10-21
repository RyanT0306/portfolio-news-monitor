# 開發工作流：VS Code ＋ Claude

這份文件寫給專案作者，也寫給之後接手的 Claude。兩邊打開的都是同一個資料夾 `portfolio-news-monitor`，所以檔案一改，兩邊都會馬上看到，不需要另外同步。

- **Claude**：負責寫程式、寫測試、跑指令、找 bug。
- **VS Code**：你在這裡看程式碼、檢查 Claude 改了什麼、自己做小修改。
- **瀏覽器**：在 http://localhost:5173 實際試用。

---

## 1. 每次開工

1. **用 VS Code 開專案**：選「檔案 → 開啟資料夾」，選 `portfolio-news-monitor`。右下角應該顯示 `3.13.16 ('.venv')`。
2. **啟動網站**：按 `Cmd+Shift+P`，輸入 `Tasks: Run Task`，選 **Start app**。
   - 下方會開兩個終端機分頁，一個是後端（port 8000），一個是前端（port 5173）。
   - 打開 http://localhost:5173 就能用。
   - 後端改了 Python 檔存檔後會自動重啟，FinBERT 會重新載入幾秒。前端改了存檔，畫面會自動更新。
   - 如果看到 `address already in use`，代表網站已經在跑了（例如 Claude 先開了），直接用就好。想知道是誰開的，可以執行：

     ```bash
     lsof -ti tcp:8000
     ```

3. **確認起點乾淨**：VS Code 左側分岔圖示的「原始碼控制」（Source Control）應該是空的。如果有東西，表示上次有修改還沒 commit，先決定要留下還是丟掉（見第 5 節）。

---

## 2. 做一個功能的循環（最重要）

每個功能都照這 6 步走，**一次只做一件事**。

| 步驟 | 誰做 | 做什麼 |
|---|---|---|
| ① 說需求 | 你 | 用下面的範本告訴 Claude |
| ② 看計畫 | 你＋Claude | 比較大的改動先說「先給我計畫，不要動手」，看完再說「可以開始」 |
| ③ 實作 | Claude | 先寫測試，再寫程式，跑完所有測試，在瀏覽器實測 |
| ④ 檢查改動 | 你 | 在「原始碼控制」點每個檔案，看綠色（新增）和紅色（刪除）的行 |
| ⑤ 試用 | 你 | 在瀏覽器操作一遍，也試試把視窗拉窄（手機寬度） |
| ⑥ 存檔點 | 你或 Claude | 滿意就 commit（見第 4 節） |

### 說需求的範本

```
我想要：在歷史紀錄每一筆旁邊加一個刪除按鈕
原因：有時候分析錯了，想把那筆拿掉
做完的樣子：按了之後那筆消失，重新整理也不會回來
不要動：評分公式
```

寫得越具體，Claude 越不會猜錯。不確定怎麼描述時，直接說「我不知道怎麼講，大概是……」，Claude 會反問你。

### 看不懂程式碼時

- 在 VS Code 選取那段程式碼，然後在 VS Code 側邊欄的 Claude 面板問「這段在做什麼？」。Claude 會看到你選取的部分。
- 或在 Claude App 問「`HoldingsEditor.tsx` 第 20 行在做什麼？」。

作品集面試時你要能講出程式在做什麼，所以第 ④ 步不要跳過。

---

## 3. 自己改，還是請 Claude 改？

| 情況 | 建議 |
|---|---|
| 改一個英文字、一個顏色、一個間距 | 自己在 VS Code 改，比較快 |
| 新功能、改到好幾個檔案、修 bug | 請 Claude |
| 不確定會影響到哪裡 | 先問 Claude「改 X 會影響哪些地方？」 |

**兩條規則：**
1. **不要和 Claude 同時改同一個檔案。** 你在 VS Code 改了還沒存檔，Claude 又改同一個檔案時，VS Code 會跳出版本衝突的提示。請先存檔（`Cmd+S`）再請 Claude 動手。
2. **自己改完要跟 Claude 說一聲**，例如「我把按鈕文字改成 Run analysis 了」，Claude 才不會蓋掉你的修改。

---

## 4. 測試與 commit

### 跑測試

按 `Cmd+Shift+P`，輸入 `Tasks: Run Test Task`，選 **Test all**。它會依序跑後端 pytest、前端 Vitest，再做一次正式版 build。看到全部 passed 和 `built in` 就是成功。

也可以在終端機直接貼上：

```bash
cd backend && .venv/bin/pytest -q
```

```bash
cd frontend && npm test && npm run build
```

只想跑後端某一個測試時，用 VS Code 左側燒杯圖示的「測試」面板，點那個測試旁邊的播放鍵。

### Commit（存檔點）

**commit 前一定要先跑測試。** 兩種做法擇一：
- 跟 Claude 說「commit」。Claude 會寫好英文說明，並在結尾加上 `Co-Authored-By`。
- 自己在「原始碼控制」上方的框框輸入英文說明（例如 `Add a delete button to history entries`），按 Commit。

一個 commit 只放一件事，以後要找、要退回都比較容易。

---

## 5. 改壞了怎麼辦

| 情況 | 做法 |
|---|---|
| 還沒 commit，想丟掉某個檔案的修改 | 「原始碼控制」裡那個檔案旁邊的彎箭頭（捨棄變更 Discard Changes）。**捨棄後無法復原**，按之前先確認。 |
| 已經 commit，想取消那次修改 | 跟 Claude 說「用 git revert 取消 xxx 那個 commit」。revert 會新增一個「反向」的 commit，舊的紀錄還在，隨時可以再找回來。 |
| 想看以前做過什麼 | 「原始碼控制」下方的圖表（Graph），或在終端機貼上 `git log --oneline` |
| 想大膽試一個不確定的點子 | 跟 Claude 說「開一個新分支試試看」。不喜歡就切回 `main`，原本的程式完全不受影響。 |

---

## 6. 每次收工

1. 想留的修改都 commit，「原始碼控制」清空。
2. 如果這次做了比較多事，跟 Claude 說「更新 docs/HANDOFF.md」，把目前狀態寫進去。
3. 停止網站：在那兩個終端機分頁按 `Ctrl+C`，或按分頁旁的垃圾桶圖示。

---

## 7. 什麼時候開新的 Claude 對話

- 要做一個和之前無關的新主題。
- 對話已經很長，Claude 開始忘記前面的事情。

新對話的第一句話：

```
先讀 docs/HANDOFF.md 和 docs/WORKFLOW.md，然後告訴我目前狀態。
```

---

## 8. 安全須知

- **API key 只放在 `backend/.env`**。不要貼到對話、程式碼或截圖裡。
- `.gitignore` 已經排除 `.env`。每次 commit 前在「原始碼控制」看一眼，清單裡不應該出現 `.env`。
- 之後要把專案放上 GitHub 當作品集時，也請 Claude 先檢查一遍有沒有敏感資料。

---

## 速查表

| 我想要 | 怎麼做 |
|---|---|
| 啟動網站 | `Cmd+Shift+P` → `Tasks: Run Task` → Start app |
| 跑全部測試 | `Cmd+Shift+P` → `Tasks: Run Test Task` → Test all |
| 看 Claude 改了什麼 | 左側分岔圖示「原始碼控制」→ 點檔案 |
| 問某段程式碼 | 選取 → VS Code 的 Claude 面板提問 |
| 存檔點 | 跟 Claude 說「commit」，或在原始碼控制按 Commit |
| 取消一次 commit | 跟 Claude 說「git revert 那個 commit」 |
| 停止網站 | 終端機分頁按 `Ctrl+C` |
| 開新對話 | 「先讀 docs/HANDOFF.md 和 docs/WORKFLOW.md」 |
