# 來源

從 [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)（MIT，見 LICENSE）複製，版本 `7246805`（2026-10-12）。

只放了 `.claude/skills/ui-ux-pro-max`，沒有 `scripts/tests`。改了一處：SKILL.md 裡執行 search.py 的路徑原本是外掛用的 `${CLAUDE_PLUGIN_ROOT}`，改成 `$(git rev-parse --show-toplevel)`，讓它在這個 repo 裡直接能用。

腳本只用 Python 標準函式庫、不連網；只有加 `--persist` 時會在 `design-system/` 下寫檔。要更新：重新複製同一個資料夾，再做一次上面的路徑替換。
