# CLAUDE.md

## Workflow
- Do not create PRs unless explicitly asked
- Push directly to a feature branch and tell me the branch name
- Do not install or look for gh CLI — it is not available on this machine
- Use the GitHub API directly if any GitHub operations are needed

## Stack
- React + Vite
- Deployed on Cloudflare Pages (auto-deploys on merge to master)
- Styling: CSS variables in index.css

## Key conventions
- All week/date calculations based on training start date stored in localStorage
- No hardcoded week numbers anywhere