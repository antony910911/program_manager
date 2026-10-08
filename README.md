# Program Manager

一個類似 Trello Premium 的專案管理工具。目前是**前端 MVP**（資料存在瀏覽器 localStorage），架構設計成之後可以直接接上後端。

## 快速開始

```bash
npm install
npm run dev      # 開發模式 http://localhost:5173
npm run build    # 型別檢查 + 打包
npm run lint
```

## 已完成功能

| 類別 | 功能 |
| --- | --- |
| 看板（Trello 基本功能） | 多個看板、清單、卡片；卡片在清單間拖曳排序、清單拖曳排序；點擊即可改名 |
| 卡片詳情 | 標籤、成員、開始日／到期日、描述、待辦清單（含進度條）、留言、完成勾選、封存／還原、刪除 |
| **Premium 檢視** | **表格**（可排序）、**行事曆**（拖曳改到期日）、**時間軸**（甘特圖，依清單分組）、**儀表板**（完成率、逾期、各清單／標籤／成員統計、活動紀錄） |
| **Premium 功能** | **自訂欄位**（文字／數字／下拉選單）、進階篩選（關鍵字、標籤、成員、到期狀態，所有檢視共用） |

## 程式結構

```
src/
  types.ts              資料模型（Board / List / Card / Label / CustomField …）
  store.ts              reducer + actions + localStorage 持久化 + 篩選/日期工具
  App.tsx               頂部列、看板首頁、檢視切換、篩選列、看板設定
  components/
    CardModal.tsx       卡片詳情視窗
    common.tsx          Avatar、標籤、InlineEdit、AddForm 等共用元件
  views/
    BoardView.tsx       看板（原生 HTML5 拖放）
    TableView.tsx       表格
    CalendarView.tsx    行事曆
    TimelineView.tsx    時間軸
    DashboardView.tsx   儀表板
```

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
