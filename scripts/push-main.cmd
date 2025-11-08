@echo off
setlocal
cd /d "%~dp0\.."

REM Stage and commit root .gitignore changes
git add .gitignore
git commit -m "chore(gitignore): ignore .env and local env files" -m "Add .env and *.local variants to root .gitignore to prevent committing secrets."

REM Stage and commit backend .gitignore changes
git add backend\.gitignore
git commit -m "chore(backend): ignore local SQLite database file" -m "Add backend/database.sqlite to .gitignore to avoid committing local data."

REM Stage and commit DEPLOY.md documentation updates
git add DEPLOY.md
git commit -m "docs(deploy): add Supabase DNS troubleshooting and local health checks" -m "Document DNS fix (Cloudflare/Google), local backend health endpoint, and env management on Vercel."

REM Rebase onto remote main and push
git pull origin main --rebase --allow-unrelated-histories
git push -u origin main

endlocal