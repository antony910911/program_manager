# 部署到自己的網站（GitHub Pages ＋ Supabase）

完成後你會有一個自己的網址，例如 `https://antony910911.github.io/program_manager/`。在手機、電腦、公司電腦、iPad 用同一組 Email／密碼登入，資料就會即時同步。

整個流程大約 20 分鐘，全部使用免費方案：

- **Supabase**：負責資料庫和登入。
- **GitHub Pages**：負責放網站。

> 程式碼放在公開的 GitHub repo，但你的看板資料存在 Supabase。資料庫有「每個人只能讀寫自己資料」的規則（`supabase/schema.sql`），別人看不到你的資料。

---

## 第 1 步：建立 Supabase 專案

1. 到 <https://supabase.com>，按 **Start your project**，用 GitHub 帳號登入。
2. 按 **New project**：
   - **Name**：隨意，例如 `arbor`
   - **Database Password**：按 Generate 產生一組，記在密碼管理器（之後幾乎用不到）
   - **Region**：選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**，離台灣近比較快
3. 等 1～2 分鐘，專案建立完成。

## 第 2 步：建立資料表

1. 左側選單 **SQL Editor** → **New query**。
2. 打開這個 repo 的 [`supabase/schema.sql`](supabase/schema.sql)，把內容全部複製貼上。
3. 按 **Run**，看到 `Success. No rows returned` 就完成了。

## 第 3 步：設定登入

1. 左側 **Authentication** → **URL Configuration**：
   - **Site URL** 填你的網址：`https://antony910911.github.io/program_manager/`
   - **Redirect URLs** 按 Add URL，再加一次同一個網址
   - 確認信和「Email 連結登入」點下去之後，會回到這個網址。
2. （可選，只有自己用時建議做）**Authentication** → **Sign In / Providers** → **Email**：把 **Confirm email** 關掉。這樣註冊後不用收確認信，可以直接登入。

## 第 4 步：複製兩個連線資訊

左側 **Project Settings**（齒輪）→ **API**（新版介面叫 **Data API** 和 **API Keys**）：

- **Project URL**：像 `https://abcdefgh.supabase.co`
- **anon public key**：一長串以 `eyJ` 開頭的字。新版介面也可能顯示 **Publishable key**（`sb_publishable_` 開頭），用這個也可以。

> 這兩個是「公開」資訊，本來就會放進網站裡。**不要**複製 `service_role` 或 `secret` key。

## 第 5 步：把連線資訊交給程式

把第 4 步的兩個值填進 repo 裡的 [`.env.production`](.env.production)：

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

也可以直接把這兩個值貼給 Claude，請它幫你填好並推上去。

## 第 6 步：打開 GitHub Pages（只要做一次）

1. 打開 <https://github.com/antony910911/program_manager/settings/pages>（就是 repo 的 **Settings** → 左側 **Pages**）。
   - 手機上 Settings 分頁可能藏在 repo 頁面上方分頁列的最右邊，或「⋯」選單裡。直接打開上面的連結最快。
2. 找到 **Build and deployment** → **Source**，下拉選單選 **GitHub Actions**。選了就會自動儲存，不用按其他按鈕。
3. 之後只要有新程式推上去，網站就會自動部署。第一次可以到 **Actions** 分頁 → 左邊 **Deploy to GitHub Pages** → 右邊 **Run workflow** → 綠色 **Run workflow** 手動跑一次，或請 Claude 幫你觸發。
4. 1～2 分鐘後出現綠色勾勾，網站就上線了。

> 這個 repo 目前的預設分支就是 `claude/trello-premium-project-tool-4qoyji`，推到這個分支或 `main` 都會自動部署。

## 第 7 步：開始使用

1. 打開 `https://antony910911.github.io/program_manager/`，在「註冊」分頁用你的 Email 和密碼（至少 6 個字元）建立帳號。
2. 其他裝置打開同一個網址，用「登入」分頁輸入同一組 Email／密碼。
3. 加到主畫面，就會像 App 一樣有圖示、全螢幕開啟：
   - **iPhone／iPad**：Safari → 分享 → 加入主畫面
   - **Android**：Chrome → ⋮ → 加到主畫面（或「安裝應用程式」）
   - **電腦**：Chrome／Edge 網址列右邊的「安裝」圖示，或加入書籤

忘記密碼時，在登入畫面選「Email 連結」，收信點連結就能登入。

## 連接 Beamup（在 Beamup 打待辦，直接進上方「待辦」清單）

只要做一次：

1. Supabase → **SQL Editor** → **New query**，把 [`supabase/inbox.sql`](supabase/inbox.sql) 全部貼上 → **Run**。
2. 打開 Arbor 並登入 → 右上角「外觀」→ 最上面的 **連接 Beamup** → **產生連接碼** → **複製連接碼**。
3. 打開 Beamup → 右上角齒輪 **設定** → 「待辦事項 → 專案管理工具」，把連接碼貼進第一格 → 按 **測試連線**，看到「連線成功」就好了。

之後在 Beamup 新增待辦，幾秒內就會出現在 Arbor 雙層模式上方的「待辦」清單，卡片上有綠色的 Beamup 標記：

- 用 `!!` 標成高優先的會放進「急件」。
- 截止日會變成卡片的到期日，`#標籤` 和備註會寫進卡片描述。
- 在 Beamup 修改或勾選完成，卡片也會跟著改。
- 在 Beamup 刪除，卡片會被封存，不會直接刪掉。
- Arbor 沒開著也沒關係，待辦會先放在 Supabase，下次打開時再收進來。

連接碼等同一把鑰匙，只能用來「送待辦進來」，看不到你的資料。不小心外流的話，按「換一組」，舊的就會失效，再把新的貼到 Beamup。

## 把 claude.ai 版的資料搬過來

1. 打開舊的 claude.ai 版 → 右上角「外觀」→ 往下到 **備份與搬家** → 按 **複製全部資料**。
2. 打開新網站並登入 → 「外觀」→ **備份與搬家** → 把剛剛複製的內容貼進文字框 → 按 **匯入**，再按一次確認。
3. 幾秒後右上角顯示「已同步」，其他裝置也會看到。

---

## 用 Vercel 取代 GitHub Pages（可選）

如果想要更短的網址（`xxx.vercel.app`），或之後 repo 改成私人：

1. 到 <https://vercel.com> 用 GitHub 登入 → **Add New → Project** → 選 `program_manager`。
2. 不用另外設定變數，Vercel 也會讀 `.env.production`。
3. 按 **Deploy**。完成後，把 Vercel 給的網址填回 Supabase 的 Site URL 和 Redirect URLs（第 3 步）。

## 在自己電腦上開發（可選）

```bash
cp .env.example .env.local   # 填入第 4 步的兩個值
npm install
npm run dev
```

## 常見問題

| 狀況 | 解法 |
|---|---|
| 打開網站是空白頁 | 到 Actions 看部署有沒有成功；確認 Pages 的 Source 是 GitHub Actions |
| 網站沒有登入畫面，右上角顯示「只存在這台裝置」 | `.env.production` 的兩個值沒填好。填好推上去後會自動重新部署 |
| 註冊後一直說帳號還沒確認 | 去信箱點確認信，或照第 3 步把 Confirm email 關掉 |
| 確認信的連結打開是錯的網址 | 第 3 步的 Site URL／Redirect URLs 要填你的網站網址 |
| 右上角出現同步警告 | 確認第 2 步的 SQL 有跑成功（Table Editor 裡要看得到 `user_docs`） |
| Beamup 說「Arbor 還沒設定好」 | 照「連接 Beamup」第 1 步執行 `supabase/inbox.sql` |
| Beamup 說「連接碼已失效」 | 到 Arbor 重新複製連接碼，貼回 Beamup |
| Supabase 專案顯示 Paused | 免費專案超過一週沒人使用會暫停，進 Supabase 按 **Restore** 即可，資料不會消失 |
