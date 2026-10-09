# Program Manager

一個類似 Trello Premium 的專案管理工具。目前是**前端 MVP**（資料存在瀏覽器 localStorage），架構設計成之後可以直接接上後端。

## 快速開始

```bash
npm install
npm run dev      # 開發模式 http://localhost:5173
npm run build    # 型別檢查 + 打包
npm run lint
```

## 部署到自己的網站

照 **[DEPLOY.md](DEPLOY.md)** 的步驟：Supabase（資料庫＋登入）＋ GitHub Pages（網站），全部免費，大約 20 分鐘。完成後用 Email／密碼登入，所有裝置同步；舊資料可用「外觀 → 備份與搬家」搬過去。

## 線上試用（claude.ai 版）

已發布的版本：https://claude.ai/artifact/HbbDuWHfy3JdqJ8QMxMP9V （需要登入 claude.ai；預設只有擁有者能開，可從頁面的 Share 選單分享）。

在 claude.ai 上開啟時，資料會同步到你的 claude.ai 帳號（artifact 的 `db`，存在你個人私有的 `data/users/<你的 id>/` 底下），手機、電腦、iPad 只要登入同一個帳號就會即時同步；右上角的雲朵圖示顯示同步狀態。在其他地方（`npm run dev`、靜態主機）則只存在該瀏覽器的 localStorage。

手機與平板：長按卡片或清單標題約 0.25 秒即可拖曳（`src/touch.ts` 用 mobile-drag-drop 把觸控轉成拖放事件）。要重新產生單一檔案版本：`npm run build:single`，輸出在 `dist-single/program-manager.html`。

## 已完成功能

| 類別 | 功能 |
| --- | --- |
| 看板（Trello 基本功能） | 多個看板、清單、卡片；卡片在清單間拖曳排序、清單拖曳排序；點擊即可改名 |
| 卡片詳情 | 標籤、成員、開始日／到期日、描述、待辦清單（含進度條）、留言、完成勾選、封存／還原、刪除 |
| **Premium 檢視** | **表格**（可排序）、**行事曆**（拖曳改到期日）、**時間軸**（甘特圖，依清單分組）、**儀表板**（完成率、逾期、各清單／標籤／成員統計、活動紀錄） |
| **Premium 功能** | **自訂欄位**（文字／數字／下拉選單）、進階篩選（關鍵字、標籤、成員、到期狀態，所有檢視共用） |
| **外觀自訂** | 8 組主題預設；淺色／深色／跟隨系統；任意主色；4 種字型與文字大小；圓角、清單寬度、清單透明度、密度、毛玻璃；4 種卡片樣式；標籤顯示方式；成員顏色；主題 JSON 匯出／匯入 |
| **看板背景** | 10 組漸層預設；純色、雙色漸層（可調角度）、圖片網址或上傳圖片 |
| **卡片封面** | 10 種預設色或任意自訂顏色 |
| **清單顏色** | 每個清單可選預設色或任意顏色（清單選單 ⋯） |
| **雙層模式**（原創） | 上方清單（預設待辦／進行中／急件）與下方各看板的清單都可改名、新增、刪除、排序；卡片與清單可上下互相拖曳，清單可跨看板移動；卡片會記住原本的看板與清單，可一鍵「移回原清單」；上下比例可拖曳調整 |
| **外星人夥伴**（來自 Beamup） | 首頁的像素外星人（Blip、Zorp、Pom、Glim、Bolt）：戳他、連戳會頭暈、長按摸頭、點空地叫他走過去；會自己散步、跳舞、接星星、開飛碟；完成卡片／待辦清單、新增卡片、設到期日、留言都會餵他星星，累積經驗升級、連續天數、解鎖配件；狀態跟資料一起同步 |
| **看板範本** | 新增看板時可選空白、年度專案（每個專案一個清單）或待辦／進行中／完成 |

## 程式結構

```
src/
  types.ts              資料模型（Board / List / Card / Label / CustomField …）
  store.ts              reducer + actions + localStorage 持久化 + 篩選/日期工具
  dnd.ts                共用的拖放狀態與放置邏輯
  sync.ts               雲端同步（每個看板／清單一份文件，逐文件合併；後端是 claude.ai artifact db 或 Supabase）
  supabase.ts           Supabase 連線與資料表介面（自架網站用）
  touch.ts              觸控拖曳（長按拖曳）
  alien/                Beamup 的外星人系統（aliens 角色圖鑑、mascot 動畫與互動、pet 養成），index.ts 是型別化的入口
  theme.ts              主題預設、背景預設、色彩工具、主題 → CSS 變數
  App.tsx               頂部列、看板首頁、檢視切換、篩選列、看板設定
  components/
    CardModal.tsx       卡片詳情視窗
    common.tsx          Avatar、標籤、InlineEdit、AddForm 等共用元件
    controls.tsx        Segmented、Slider、ColorPicker、Toggle
    AppearancePanel.tsx 外觀設定側欄
    BackgroundEditor.tsx 看板背景編輯器
    AlienHero.tsx       首頁的外星人舞台、養成狀態與換角色／配件
    AuthGate.tsx        自架網站的登入畫面（Email＋密碼、Email 連結）
    DataTransfer.tsx    備份與搬家（複製全部資料／貼上匯入）
    ListColumn.tsx      清單欄、卡片方塊、清單選單（看板與雙層模式共用）
  views/
    BoardView.tsx       看板（原生 HTML5 拖放）
    TableView.tsx       表格
    CalendarView.tsx    行事曆
    TimelineView.tsx    時間軸
    DashboardView.tsx   儀表板
    SplitView.tsx       雙層模式
```

外觀設定會轉成 CSS 變數（`--accent`、`--radius`、`--list-w`…）寫在 `<html>` 上，`index.css` 只讀這些變數，所以要新增一個可調整的項目，只需要在 `Theme` 加欄位、在 `themeVars()` 輸出變數、在 CSS 使用它。

雙層模式的上方清單存放在一個隱藏的「焦點看板」（`focusBoardId`）裡；卡片用 `homeBoardId` 記住所屬專案，所以拖到上方後，專案的表格、時間軸、行事曆仍看得到它。

所有資料變更都經過 `store.ts` 的 `Action`，之後接後端時只要把 dispatch 改成「呼叫 API + 樂觀更新」即可，UI 幾乎不用動。

## 接下來的路線圖

要從 MVP 變成真正可多人使用的產品，建議依序做：

### 1. 後端與資料庫
- 技術建議：**Node.js（NestJS 或 Fastify）+ PostgreSQL + Prisma**，或直接用 **Supabase**（內建 Auth、Postgres、Realtime，最快上線）。
- 資料表對應 `types.ts`：`workspaces`、`boards`、`lists`、`cards`、`labels`、`card_labels`、`card_members`、`checklist_items`、`comments`、`custom_fields`、`card_custom_field_values`、`activities`、`attachments`。
- 排序用 **fractional index**（例如 `position` 欄位存字串 / 浮點數），拖曳時只更新被移動那張卡片，不必重寫整個清單。

### 2. 帳號與權限
- 登入：Email + OAuth（Google / GitHub）。
- 階層：**Workspace → Board → List → Card**；角色：Owner / Admin / Member / Observer（Trello Premium 的 Observer 角色）。
- 看板可見性：私人 / Workspace / 公開。

### 3. 即時協作
- WebSocket（Socket.IO）或 Supabase Realtime：一人拖卡片，其他人畫面即時更新。
- 每個看板一個 room；伺服器廣播 action，前端套用同一個 reducer。

### 4. 其他 Premium 功能
- **Butler 自動化**：規則引擎「當卡片移到『完成』→ 勾選完成並通知成員」，以 trigger / condition / action 存成 JSON，用佇列（BullMQ）執行。
- 附件上傳（S3 / R2）、封面圖片。
- 範本看板、Workspace 層級的跨看板表格與行事曆。
- 通知（站內 + Email）、@提及。
- 匯出 CSV / JSON、管理員稽核紀錄。
- 地圖檢視（卡片加地點欄位）。

### 5. 付費方案
- Stripe Subscription：Free（看板數、Power-Up 數量有上限）/ Premium（解鎖檢視、自訂欄位、自動化次數）。
- 後端以 middleware 檢查 workspace 的方案決定功能開關（feature flags）。

### 6. 部署
- 前端：Vercel / Netlify / Cloudflare Pages。
- 後端：Fly.io / Render / Railway；資料庫：Neon / Supabase。
- CI：GitHub Actions 跑 lint、type check、測試（Vitest + Playwright）。
