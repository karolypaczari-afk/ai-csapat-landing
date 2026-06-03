# ai-csapat-landing — AUTO-GENERÁLT mirror ⚠️

**NE szerkeszd ezt a repót kézzel — minden szinkron felülírja.**

Ez a [GENmarketerHU/ai-marketing-team] monorepo `landing-ai-csapatod/` mappájának
auto-szinkronizált, CSAK-landoló tükre (index/css/js/assets + prod .htaccess).
A Hostinger natív Git-deploy ezt húzza → https://ai-csapat.genmarketer.hu/.

## Szerkesztés (bármely gépről)
A **monorepóban** dolgozz (`landing-ai-csapatod/`), `git push origin main` →
a sync-workflow ide tükrözi → Hostinger pull → ~35 mp múlva élő.

## Teljes runbook + buktatók + recovery
A monorepo **`docs/13-ai-csapat-deploy.md`** (lineáris-history invariáns,
webhook-URL-csere, `git reset --hard origin/main` recovery).
