# Scripts (private only — excluded from public mirror)

```powershell
pnpm gatekeeper
pnpm public:sync -- "commit message"   # [-F] gatekeeper → sync mirror → local commit
pnpm public:release                    # [-F] push + tag (npm publish = GitHub Action)
pnpm test:public-scripts
```

Mirror: `E:\Projects\OpenPagesPublic` → `git@github.com:pieisalietoo/OpenPages.git`  
`-F` bypasses work-hours and unlocks first release (no npm / no tags yet).  
npm publish is **not** local: tag `v*` triggers `.github/workflows/publish.yml` via [trusted publishers](https://docs.npmjs.com/trusted-publishers) (OIDC).
