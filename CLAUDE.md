# CLAUDE.md

## Workflow
- Commit changes locally with descriptive messages, but do not push — pushing is done manually via GitHub Desktop
- Do not create PRs unless explicitly asked
- Do not install or look for gh CLI — it is not available on this machine
- Use the GitHub API directly if any GitHub operations are needed

## Stack
- React + Vite
- Deployed on Cloudflare Pages (auto-deploys on merge to master)
- Styling: CSS variables in index.css

## Key conventions
- All week/date calculations based on training start date stored in localStorage
- No hardcoded week numbers anywhere

## Roadmap
- See ROADMAP.md for current priorities. Work items are ordered - complete phase 1 befoer moving to phase 2.