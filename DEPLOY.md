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
   - **Name**：隨意，例如 `mothership`
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
2. 打開 Mothership 並登入 → 右上角「設定」→ **Beamup** → **產生連接碼** → **複製連接碼**。
3. 打開 Beamup → 右上角齒輪 **設定** → 「待辦事項 → 專案管理工具」，把連接碼貼進第一格 → 按 **測試連線**，看到「連線成功」就好了。

之後在 Beamup 新增待辦，幾秒內就會出現在 Mothership 雙層模式上方的「待辦」清單，卡片上有綠色的 Beamup 標記：

- 用 `!!` 標成高優先的會放進「急件」。
- 截止日會變成卡片的到期日，`#標籤` 和備註會寫進卡片描述。
- 在 Beamup 修改或勾選完成，卡片也會跟著改。
- 在 Beamup 刪除，卡片會被封存，不會直接刪掉。
- Mothership 沒開著也沒關係，待辦會先放在 Supabase，下次打開時再收進來。

連接碼等同一把鑰匙，只能用來「送待辦進來」，看不到你的資料。不小心外流的話，按「換一組」，舊的就會失效，再把新的貼到 Beamup。

## 連接行事曆（Google／Outlook／iCloud 雙向同步）

完成後，有日期的卡片會變成行事曆上的行程。行事曆上今天起 90 天內的行程，也會變成雙層模式上方「行事曆」清單的卡片。兩邊的新增、修改、完成、刪除都會同步：

- 卡片完成時，行程標題前會加上「✓ 」；在行事曆把「✓ 」拿掉，卡片會變回未完成。
- 在 Mothership 刪除卡片，行程也會刪掉；在行事曆刪除行程，卡片會進垃圾桶，30 天內可救回。
- 定時的行程（例如 14:00–15:00）在卡片上會顯示時間；在 Mothership 改卡片日期時，行程會保留原本的時段，只換日期。

需要一個在 Supabase 上執行的小程式（Edge Function）。它負責保管行事曆的登入資訊，網頁本身看不到，資料表也只有這個程式能讀。第 1～3 步只要做一次。

### 第 1 步：建立資料表

Supabase → **SQL Editor** → **New query**，貼上 [`supabase/calendar.sql`](supabase/calendar.sql) 全部內容 → **Run**。

### 第 2 步：讓 GitHub 可以幫你部署到 Supabase

1. 打開 <https://supabase.com/dashboard/account/tokens> → **Generate new token** → 名稱填 `github` → 產生後**複製**（只會顯示一次）。
2. 打開 <https://github.com/antony910911/program_manager/settings/secrets/actions> → **New repository secret**：
   - **Name**：`SUPABASE_ACCESS_TOKEN`
   - **Secret**：貼上剛剛複製的 token
   - 按 **Add secret**。

> 這個 token 等於你 Supabase 帳號的鑰匙，只放在 GitHub Secrets，不要貼給任何人（包括 Claude）。

### 第 3 步：部署

打開 <https://github.com/antony910911/program_manager/actions/workflows/supabase-functions.yml> → 右邊 **Run workflow** → 綠色 **Run workflow**。1～2 分鐘後出現綠色勾勾就完成了。

到這裡，**iCloud 行事曆**已經可以用了（見第 6 步）。Google 和 Outlook 還要再各做一次設定。之後每次在第 4、5 步新增或修改 Secret，都要再跑一次這個 workflow。

### 第 4 步：Google 日曆

1. 打開 <https://console.cloud.google.com/projectcreate>，專案名稱填 `Mothership` → **建立**，然後確認上方選到這個專案。
2. 打開 <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com> → **啟用**。
3. 打開 <https://console.cloud.google.com/auth/overview> → **開始**：
   - 應用程式名稱：`Mothership`；使用者支援電子郵件：選你自己
   - 目標對象：**外部**
   - 聯絡資訊：你的 Email → 同意政策 → **建立**
4. 左邊 **目標對象** → **發布應用程式** → 確認。這一步很重要：沒有發布的話，Google 每 7 天會讓連線失效。
5. 左邊 **用戶端** → **建立用戶端**：
   - 應用程式類型：**網頁應用程式**；名稱：`Mothership`
   - **已授權的重新導向 URI** → 新增：`https://antony910911.github.io/program_manager/`
   - **建立** → 複製 **用戶端 ID** 和 **用戶端密鑰**
6. 回到 GitHub Secrets（同第 2 步的網址），新增兩個：`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`。
7. 照第 3 步再跑一次 workflow。

第一次連接時，Google 會顯示「Google 尚未驗證這個應用程式」。這是因為這個 App 是你自己建的，按 **進階** → **前往 Mothership（不安全）** → 允許即可。

### 第 5 步：Outlook（公司帳號）

1. 用公司帳號登入 <https://entra.microsoft.com> → **應用程式註冊** → **新增註冊**：
   - 名稱：`Mothership`
   - 支援的帳戶類型：**僅此組織目錄中的帳戶**
   - 重新導向 URI：平台選 **Web**（不是 SPA），填 `https://antony910911.github.io/program_manager/`
   - **註冊**
2. 在 **概觀** 複製 **應用程式 (用戶端) 識別碼** 和 **目錄 (租用戶) 識別碼**。
3. **憑證及祕密** → **新增用戶端密碼** → 期限選最長 → 複製 **值**（不是「祕密識別碼」）。到期前要換一組新的，換完記得更新 GitHub Secret。
4. **API 權限** → **新增權限** → **Microsoft Graph** → **委派的權限**，勾 `Calendars.ReadWrite`、`offline_access`、`User.Read` → **新增權限**。
5. GitHub Secrets 新增三個：
   - `MS_CLIENT_ID`：應用程式 (用戶端) 識別碼
   - `MS_CLIENT_SECRET`：密碼的值
   - `MS_TENANT`：目錄 (租用戶) 識別碼
6. 照第 3 步再跑一次 workflow。

> 公司沒有開放自己註冊 App，或連接時出現「需要系統管理員核准」，就把這一步交給 IT。只需要上面三個最小的行事曆權限。Beamup 已經註冊過的 App 也可以沿用：加一個 **Web** 平台的重新導向 URI 和一組用戶端密碼就好。

### 第 6 步：在 Mothership 連接

打開 Mothership → 右上角 **設定** → **行事曆同步**：

- **Google／Outlook**：按「連接 Google 日曆」或「連接 Outlook」→ 登入並允許 → 自動回到 Mothership，下方會顯示「已連接」。
- **iCloud**：先到 <https://account.apple.com/account/manage> → **登入與安全性** → **App 專用密碼** → 產生一組（名稱填 Mothership）。回到 Mothership 按「連接 iCloud 行事曆」，輸入 Apple ID 和這組密碼。不要輸入你的 Apple ID 密碼。

連接後可以設定：

- **同步的行事曆**：每個帳號要同步哪一本行事曆。
- **Mothership 新增的卡片寫到這個行事曆**：有日期的新卡片要放到哪一個帳號。一張卡片只會對應一個行程，所以 iPhone 同時顯示三個帳號時，也不會看到重複。

### 在 Beamup 新增行程，直接進行事曆

先完成「連接 Beamup」和上面的行事曆連接，然後到 Beamup → **設定** → 「行程 → 行事曆」選 **Mothership**。

之後在 Beamup 新增的行程（例如「明天 14:00-15:30 @會議室 [跟廠商開會]」）會這樣走：

1. 送到 Mothership，變成上方「行事曆」清單的卡片，卡片上顯示時間。
2. Mothership 再把它寫進你勾選「新增的卡片寫到這個行事曆」的那一本，例如 iCloud，所以 iPhone 內建行事曆也看得到，而且保留時段。
3. 在 Beamup 修改時間，行事曆上的那一筆會直接改，不會多出一筆；在 Beamup 刪除，行事曆和卡片也會一起刪，卡片會先進垃圾桶。

Mothership 不用開著：行程會先放在雲端，下次打開 Mothership 時才寫進行事曆。如果想要更即時，在要用的裝置上把 Mothership 開著就好。

### 什麼時候同步

- Mothership 開著的時候：打開時、切回來時、每 2 分鐘一次，以及改完卡片後約 3 秒。
- Mothership 沒開時，行事曆上的變動會在下次打開時一起收進來，不會漏掉。
- 中斷連接後，卡片和行程都會留著，只是不再同步。

### 限制

- 行事曆的行程只會收進今天起 90 天內的。重複的行程（例如每週例會）會一次一張卡片。
- iCloud 的重複行程只能從行事曆那邊修改；在 Mothership 改這類卡片，不會改到 iCloud。
- 卡片沒有「幾點」的欄位：從 Mothership 新增的行程都是全天行程，要指定時段請在行事曆上改。

## 把 claude.ai 版的資料搬過來

1. 打開舊的 claude.ai 版 → 右上角「設定」→ **備份與搬家** → 按 **複製全部資料**。
2. 打開新網站並登入 → 「設定」→ **備份與搬家** → 把剛剛複製的內容貼進文字框 → 按 **匯入**，再按一次確認。
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
| 外觀裡寫「行事曆同步還沒部署到雲端」 | 照「連接行事曆」第 1～3 步，並確認 Actions 裡 **Deploy calendar function** 是綠色勾勾 |
| 行事曆帳號下方出現紅字 | Google：確認第 4 步有「發布應用程式」；Outlook：密碼可能過期了，換一組並更新 `MS_CLIENT_SECRET`；iCloud：App 專用密碼被撤銷了，中斷連接後重新連接 |
| Beamup 說「Mothership 還沒設定好」 | 照「連接 Beamup」第 1 步執行 `supabase/inbox.sql` |
| Beamup 說「連接碼已失效」 | 到 Mothership 重新複製連接碼，貼回 Beamup |
| Supabase 專案顯示 Paused | 免費專案超過一週沒人使用會暫停，進 Supabase 按 **Restore** 即可，資料不會消失 |
