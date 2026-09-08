# Tasks: Probes vs Zealot 2 Clicker Game

## ✅ Gebouwde mijlpalen (actuele realiteit)

### Types & strikte typering
- [x] `types/{Item,Zealot,ProbeBase,SkillTree}.ts` — volledig getypeerd, `Record<string, unknown>` i.p.v. `any` (zero `any`, `eslint no-explicit-any`)
- [x] Strict TS: `typecheck`, `lint`, `build` groen

### Composables & game-state
- [x] `useZealot.ts` (stats, HP, dynamic CPS, currency, skill-tree bonuses, deserialisatie uit `constants.ts`)
- [x] `useInventory.ts` (6 slots, geaggregeerde equipment-stats, type-safe deserialisatie)
- [x] `useCombat.ts` (reactive orchestratie; pure math in `utils/combatMath.ts`)
- [x] `useCombo.ts` (rapid-click combo multiplier)
- [x] `useSkillTree.ts` (3 branches × 7 nodes + XP)
- [x] `useSaveSystem.ts` (slots A/B/C + autosave + delete)
- [x] `useAudio.ts` (music scheduler/graph/persistence)

### Data & pure-logica-modules
- [x] `data/shopCatalog.ts` (shop-items data-driven)
- [x] `utils/combatMath.ts` (pure wall/turret/timer/rare-probe math — unit-testable)
- [x] `utils/{ranks,scaling,shopUpgrade,bigNumber,format,constants}.ts`

### Audio-engine (gemodulariseerd)
- [x] `audio/{types,sfx,synths,trackCatalog}.ts` — 7 tracks / 2 packs, procedurele synth + SFX

### Features
- [x] SS+ tier-milestones (SS→SSS→X→XD→XRD→XRFD) met eigen mechanics (Golden Aura, Nova Volley, Overdrive, Phase Walls, Reality Drift, Final Apex)
- [x] Rare/clanned/training/pather probes, global upgrade counter, wall-cycle schaling
- [x] Skill tree, combo-systeem, crits, XP, Undying, thorns-reflect
- [x] Protoss-UI (Tailwind, dark mode, glow), DEV terminal, tutorial, GameHeader

## ✅ Verbeteringen (afgerond)

### P1 — Test-infrastructuur opzetten
- [x] Vitest + @vue/test-utils toevoegen (devDependencies + `test` script)
- [x] Unit-tests voor `utils/combatMath.ts` (wall/turret/timer/rare-probe math)
- [x] Unit-tests voor `utils/scaling.ts`, `utils/format.ts`, `utils/bigNumber.ts`
- [x] Unit-tests/smoke-test voor `composables/useCombo.ts`
- **Acceptatie:** `npm test` draait groen (64 tests).

### P2 — Game.vue opsplitsen
- [x] De 4 `window.setInterval` loops (auto-attack 25ms, fast 100ms, slow 1000ms, autosave 120s) extraheren naar een `useGameLoop` composable
- [x] Game-loop lifecycle (idempotente `startLoops`/`stopLoops`) uit `Game.vue` verhuizen
- **Acceptatie:** gedrag identiek; `typecheck`, `lint`, `build` groen.

### P3 — Bugfix: wallXp gebruikt verkeerd wall-level
- [x] In `handleWallDestroyed` het vernietigde wall-level vooraf capturen (zoals `wallMaxHp` al doet) i.p.v. na de probewissel af te lezen
- **Acceptatie:** XP-refresh klopt met het werkelijk vernietigde wall-level.

### P4 — Bugfix: combo niet gereset bij load
- [x] `combo.resetCombo()` aanroepen bij `handleLoadSlot`
- **Acceptatie:** laden van een save start met een schone/geresette combo-teiler.

### P5 — Deduplicatie useCombo
- [x] `registerClick` en `registerAutoAttackClick` (identieke logica) samengevoegd tot één `registerClick`
- **Acceptatie:** geen gedupliceerde logica; `useCombo` blijft type-safe.

### P6 — localStorage keys centraliseren
- [x] Gedupliceerde `pvz2_*` keys verspreid over `Game.vue`, `useCombat`, `useZealot`, `useInventory`, `useAudio`, `combatMath` centraliseren in `utils/keys.ts`
- **Acceptatie:** alle lees/schrijf-hebbers gebruiken dezelfde constante (plus fix: autosave-key nu consistent).

### P7 — Opruiming
- [x] Lege `<style scoped>` blokken verwijderen (13 componenten)
- [x] Dode/ongebruikte imports opgeschoond
- **Acceptatie:** `lint` en `typecheck` blijven groen, geen dead code.

## ✅ Zealot Levels + Talent Points + Uitgebreide Talent Tree (afgerond)

### T1 — Zealot levels i.p.v. directe XP-besteding
- [x] Huidige `SkillTreeState { unlockedNodes, xp, spentXp }` vervangen door een level-model: `level` (start 1), `xp`, `talentPoints`
- [x] Elke level-up geeft **1 talentpunt**; XP is geen besteedbare valuta meer, alleen een level-balk
- [x] XP-curve schaalt met level: `xpForNextLevel(level) = floor(50 * level^1.35)`
- [x] `grantXp` rekent level-ups af en telt talentpunten op
- **Acceptatie:** geen lelijk `463/50`-tegenhanger meer; XP toont level + voortgang naar volgend level.

### T2 — Rankbare talenten (1–5 punten, 1 punt per rank)
- [x] `SkillNode` uitbreiden: `maxPoints` (1–5), effect per punt, `exclusiveGroup?` (of/of)
- [x] `SkillTreeState` krijgt `ranks: Record<string, number>` i.p.v. binaire `unlockedNodes`
- [x] Elke rank van een talent kost 1 talentpunt; effect schaalt lineair per punt
  - [x] Voorbeeld: `r3 Kinetic Plating` → 1 punt = 5% turret-reductie, max 5 = 25%
- [x] `canInvestNode` logica (prereq-row, rang < max, ≥1 punt, geen exclusief-conflict)
- **Acceptatie:** `typecheck`, `lint`, `build` groen; talenten investeren 1–5 punten.

### T3 — Exclusieve keuze-paren (of/of)
- [x] Keuze-paren: `v4/v4b` (Fury Focus / Precise Assault), `r4/r4b` (Second Wind / Bulwark), `w6/w6b` (Void Warden / Rich Vein)
- [x] Exclusief-conflict afdwingen in investeringslogica + UI (vergrendeld tonen met 🔒)
- **Acceptatie:** of/of discreet in UI en logica, geen beide-allowed.

### T4 — UI: niveau + talentpunt-badge (header rechtsboven + skill-knop)
- [x] `ZealotXpBar` herschrijven → toont Level + XP-progress + vrije talentpunten
- [x] Rond bol-badge met aantal **vrije talentpunten** wanneer >0:
  - [x] in de `GameHeader` (rechter bovenhoek, puls-effect)
  - [x] rechtsboven op de "OPEN SKILL TREE" knop (stats-kolom)
- **Acceptatie:** badge verschijnt zodra er een vrije talentpunt beschikbaar is.

### T5 — UI: talent tree modal (kern/max + invest knop)
- [x] `SkillTreeModal` + `SkillTreeNode`: toon huidige rang/max (`2/5`), effect per punt, +1 PT knop
- [x] "INVEST 1 PT" knop bij voldoende punten; vergrendelde of/of-tegenhanger tonen
- [x] Modal-header toont Level + XP-progress + vrije talentpunten i.p.v. "Available XP"
- **Acceptatie:** investeren/toevoegen werkt in-UI en persist na save/load.

### T6 — Save/load + clean reset
- [x] Nieuwe `SkillTreeState`-vorm serialiseert mee (defensieve `deserialize`, oud format → level 1 clean)
- [x] `reset()` → level 1, 0 punten, lege ranks (geen migratie van oude XP)
- **Acceptatie:** laden van oud save valt veilig naar "level 1 clean" zonder crash.

## ✅ T7 — Echte Talent Tree (max 4/rij, vertakkend) + TIJDELIJKE respec (afgerond)

### T7.1 — Boomstructuur i.p.v. lineaire "stoktakken"
- [x] `SkillNode` krijgt `parents: string[]` (leeg = root) en `col` (0–3); prereq = ≥1 parent geïnvesteerd (vervangt "vorige rij behaald")
- [x] 3 bomen × 7 rijen × maximaal 4 talenten per rij (~18 nodes/boom): Vengeance, Resilience, Wealth met echte vertakkingen + keystone (row 7, "any parent row 6")
- [x] `validateTreeLayout()` helper controleert de max-4/rij + parent-zit-in-vorige-rij contracten
- **Acceptatie:** er zijn échte takken/splitstakken zichtbaar; max 4 per rij per boom afgedwongen in data.

### T7.2 — Exclusieve punten als of/of-siblings (zichtbaar)
- [x] Exclusieve paren zijn sibling-takken (zelfde parent): Vengeance (v3a/v3b, v5a/v5b), Resilience (r3a/r3b, r5c/r5d, r6c/r6d), Wealth (w4c/w4d, w6c/w6d)
- [x] UI toont "OR"-chip tussen de twee siblings + 🔒 op de vergrendelde
- **Acceptatie:** of/of-paren zijn direct in de boom zichtbaar.

### T7.3 — Tabs i.p.v. 3 kolommen
- [x] SkillTreeModal toont per keer 1 boom (Vengeance/Resilience/Wealth) op volle breedte, tabs bovenin (desktop én mobiel)
- [x] Boom gerenderd met SVG-takken (parent→kind "elbow"-lijnen), absolute knooppunt-positionering, OR-chips
- **Acceptatie:** boom is leesbaar op desktop en mobiel (geen krappe 3-kolommen).

### T7.4 — TIJDELIJKE respec (vóór final build evalueren)
- [x] `respec()`: alle gespendeerde punten terug naar de pool, `ranks = {}`, level/XP blijven
- [x] Respec-knop in de modal, duidelijk gelabeld **TIJDELIJK**
- [x] **⚠️ Evalueren vóór final build:** onbeperkte respec kan exclusieve keuzes betekenisloos maken — evt. beperken (kosten/cooldown/permalock).
- **Acceptatie:** respec werkt; het tijdelijke karakter is duidelijk in UI + tasks aanwezig.

### T7.5 — Verificatie + save/load
- [x] `typecheck`, `lint`, `test`, `build` groen
- [x] Save/load veilig met nieuwe node-ids (defensieve deserialize)
- **Acceptatie:** oude saves laden zonder crash; alle checks groen.

### P8 — Component-smoke-tests (Vue 3, @vue/test-utils)
- [x] `Components/ZealotStatsComponent.test.ts` — titel "ZEALOT" (géén "WARRIOR"), géén HP-bar in DOM; Attack/Speed/Defense/Regen weergegeven; bonus-summary alleen bij actieve bonussen
- [x] `Components/BattleArea.test.ts` — mock-ProbeBase; toont "ZEALOT HP" met percentage (bv. `(50%)`); click op `.data-clickable` emitteert `attack`
- [x] `Components/InventoryGrid.test.ts` — 6 slot-cellen; gevuld vs leeg; ✕/Remove emitteert `unequip` met slotIndex
- **Acceptatie:** `npm test` groen (80 tests); ondersteuning via `utils/testMocks.ts` + `testSetup.ts` (img src patching) + `transformAssetUrls: false` in vitest-config.

## ✅ T8 — Probe-economie (vespene/minerals, upgrade-timer weg) — KLAAR

### T8.1 — Architectuur: eco-velden + pure math
- [x] `types/ProbeBase.ts`: eco-velden (`vespene`, `minerals`, `generatorLevel` max 10, `mineralPrice`, `marketState` + bouwtimer, `undergroundMarketBuilt`); `timeUntilUpgrade`/`maxUpgradeTime` verwijderd
- [x] `utils/economyMath.ts` (nieuw): `wallUpgradeCost(pos)` (gas `8·2^pos`; minerals vanaf U5→Mega1: 32→64→128→…→4096), `GENERATOR_UPGRADES`-tabel (rows 1–10, 7–9 locked/TODO dictaat), `MINERAL_BUY` (10 stuks / 155 gas / +5 per aankoop — comment: theoretisch gedeeld over probes, global escalation nu genegeerd), `BUILD_TIMES` (build/upgrade/sell = 4s), `probeDeathCarry` (×1.1 per rang)
- [x] `composables/useProbeEconomy.ts` (nieuw): `tickProbeEconomy` — inkomen → bouwtimer → 1 auto-actie/sec dynamische policy (wall onder dreiging → wall-prio; anders eco first), market-koop (incl. market-build-on-the-spot bij Mega-mineralen), refund/sell, pather-gas-gen, carry-over ×1.1

### T8.2 — Timer verwijderen + wall via economie
- [x] `utils/combatMath.ts`: `calculateUpgradeTime`/`getSsJourneyTimeForLevel`/`computeTierJourneyTime` weg (grep-verify); `SavedProbeData`/`coerce` + eco-velden
- [x] `composables/useCombat.ts`: timer-flow weg; wall-upgrade getriggerd door eco-callback; `advanceWallCycles` blijft dev-tool
- [x] `composables/useGameLoop.ts` + `Pages/Game.vue`: `tickProbeEconomy` in slowTick, upgrade → autosave
- [x] `Components/BattleArea.vue`: PROBE ECONOMY-readout (pool, gas/s, wall-kost + voortgang, minerals, markt-status) i.p.v. upgrade-timer

### T8.3 — Save/migratie + tests + verificatie
- [x] Save/migratie: oude saves laden → eco defaults (gen 1, lege pool, market none); geen crash
- [x] `economyMath.test.ts` nieuw (wall-kosten incl. Mega-minerals, generator-tabel, +5 prijs, ×1.1 carry); `combatMath.test.ts`/`testMocks.ts` timer-refs geschoond
- [x] **Acceptatie:** `typecheck`, `lint`, `test` (113 tests), `build` groen; begin upgrades sneller (eco-first), einde geen onbeperkte snel-upgrades (exponentiële kosten)

## ✅ T8b — Generator 6→10 + Depot/Miners (dictaat) — KLAAR
- [x] Generator 6→7 (64💎, 1600g, Ultra Wall 4); 7→8 (128💎, 3200g, Mega 1); 8→9 (256💎, 6400g, Mega 2); 9→10 (512💎, 12800g, Mega 3) — `GENERATOR_UPGRADES` volledig uitgedicteerd, `locked`/`pending` scaffolding verwijderd
- [x] Depot vanaf gen 6: 256 gas / 4s bouwen (`DepotState` + timer); 4s miner-training job (`minerTrainingType`/`minerTrainingTimer`)
- [x] 9 miner-tiers (gas→minerals/s): simple 512/0.125 · average 1024/0.25 · advanced 2048/0.5 · professional 4096/1 · master 15360/6 · ultra 71680/36 · legendary 275000/216 · perfect 1M/1296 · ludicrous 10M/17500; cap 15 miners, destruct (no refund) + replace laagste tier, max 1 ludicrous per probe
- [x] Eco-policy: gen → miners → wall → market (eco-first); threat-mode wall-prio behouden; miner-harvest loopt via `mineralAccum` (fractie 1/8s en 1/4s ratio's)
- [x] Save: `SavedProbeData`/coerce + `rebuildProbeFromSave`/`currentEco` (+ gen 6→10 kosten in genstep via market underground floor vastgelegd); oude saves → eco defaults, geen crash
- [x] UI: `BattleArea.vue` depot-status + ⛏️ miner-rate readout, gen-label zonder `locked`
- [x] Tests: `economyMath.test.ts` (tabel 6→10, 9 miner-defs, caps, slot-logica), `useProbeEconomy.test.ts` (depot build, train 4s, harvest fractie, destruct-replace, ludicrous-cap)

## ✅ T8c — Automated Mines + Repositories (dictaat) — KLAAR
- [x] Automatische mines (levels 3–8, onafhankelijke ladder, geen level-1/2): L3 1024💎→32g/s · L4 4096→128 · L5 16384→512 · L6 65536→2048 · L7 262144→8192 · L8 1.000.000→32768; 4s bouwen; cap 100 per level (provisional); `MineCounts`/`mineCounts`/`mineBuildLevel`/`mineBuildTimer` state + save/migratie
- [x] Repository: 5.000.000g, +5 miner-cap, max 3, bouwt instant (enige building zonder 4s); vereist roster vol perfect+ludicrous aan huidige cap (`rosterPerfected`), cap per stap 15→20→25→30 (`minerCap(repositories)`, clamp 3)
- [x] **Tiersleutel (dictaat):** mines/repo worden pas OVERWOGEN vanaf een Ultra-tier-of-hoger miner (`hasUltraTier`: ultra/legendary/perfect/ludicrous) — géén harde "moet ultra in roster" vereiste; de optie blijft open zodra het tier bereikt is, waardoor repo ook bij perfect+ludicrous roster bouwbaar is (geen dead code). Doel: probe focust op 1 ultra-miner i.p.v. massa lagere miners
- [x] Inkomsten: gen + mines leveren gas/s, miners leveren minerals/s via `mineralAccum`; eco-policy: gen → miners → wall → **mines/repo** → market (eco-first), threat: wall → gen → miners → **mines/repo** → market; market-koop springt bij via `needForMine`
- [x] Save/restore: `SavedProbeData`/coerce + `rebuildProbeFromSave`/`currentEco` met mine/repo-velden (validatie via `MINE_LEVELS`, clamp repos 0..3)
- [x] UI: `BattleArea.vue` ⚒️ mine readout (bouwend/tellingen + `+X/s`) + depot alle minen, dynamische `X/{cap}` via repositories (🏛️)
- [x] Wall-voorspelling (bestaande formules leveren al juiste waarden — geen formulewijziging): pos11 Mega2=128/6400 · pos12 Mega3=256/32768g · **pos13 Mega4=512💎/65536g · pos14 Power1=1024💎/131072g · pos15 Power2=2048💎/262144g**
- [x] Tests: `economyMath.test.ts` (mines-tabel L3–L8, `minerCap` 15/20/30, `hasUltraTier`, `rosterPerfected`, `mineRate`, defaults/carry); `useProbeEconomy.test.ts` (mine build 4s + gas-inkomen + kapcompletie "busy tick", repo 15→20 cap, perfected-roster bouwt mines zonder ultra, geen mines vóór ultra tier)
- [x] **Acceptatie:** `typecheck`, `lint`, `test` (**126 tests**), `build` groen

## ✅ T8d — TIJDELIJKE probe-inspect-tabel (PROBE INSPECT) — KLAAR
- [x] `BattleArea.vue`: `ref`-import + `showProbeInspect`-toggle + `[🔍 INSPECT]`-knop in de PROBE ECONOMY-header (standaard Uit → bestaande smoke-tests ongemoeid)
- [x] `inspectRows` computed: gegroepeerde rijen PROBE (rank/wallCycle/kills/rare/SS-timers) · ECONOMIE (pools, gas/s, gen, markt, depot, training) · MINERS (9 tiers + totaal/cap) · MINES (L3–L8 + build) · REPOSITORIES · WALL (pos/HP/defensie/`nextWallCost`) · TURRET · ABILITY — pure `{ heading?, label, value }`, herbouwd per tick (reactive op `probeBase`)
- [x] Inklapbare `<table>`-template (`v-if="showProbeInspect"`, monospace, groeps-koppen `colspan=2`): duidelijkheid boven mooi
- [x] **Acceptatie:** `typecheck`, `lint`, `test` (126), `build` groen; tabel toont live probe-state elke tick

## ✅ T8e — Turret-rework (13 levels, dictaat) — KLAAR
- [x] `utils/economyMath.ts`: `TURRET_DPS` (t1=1 … t12=160000; t13=524270/0.2s → display-DPS 2.621.350) + `TURRET_UPGRADE_COSTS` (12 overgangen van L naar L+1: 24g … 1M g + 750k 💎; t13 heeft geen kost) + `defenseUpgradeCost(pos)` = pos<12 → turret-tabel, pos≥12 → `wallUpgradeCost`
- [x] `utils/combatMath.ts`: `getTurretInfo` → tabel-dps; `buildTurret` level = `min(pos+1, 13)` (cap t13), **cycle-groei (×4671 per cycle) GEDESACTIVEERD** voor turret-schade (blijft in code voor walls/shop; reactivering = 🔭)
- [x] `composables/useProbeEconomy.ts`: upgrade/buy/mineral-noodzaak via `defenseUpgradeCost` (pos0–11 alleen turret-kost; pos12+ wall-kost)
- [x] `composables/useGameLoop.ts`: t13-volley — pure `turretDamageThisTick(level, volleyStep, dps)`: t13 vuurt elke 200ms `dps/5`, anders `dps/10` per 100ms tick
- [x] `Components/BattleArea.vue`: `nextWallCost` via `defenseUpgradeCost` (label ► Next defence; turret-ATK-display 2,62M/s bij t13 werkt vanzelf)
- [x] Tests: `combatMath.test.ts` (tabel/cap/geen cycle-groei), `economyMath.test.ts` (kosten-tabel + `defenseUpgradeCost`), `useProbeEconomy.test.ts` (pos0=24g i.p.v. 8g), `useGameLoop.test.ts` (volley-cadans)
- [x] **Acceptatie:** `typecheck`, `lint`, `test` (**143 tests**), `build` groen

### 🔭 Uitgesteld (toekomstige todo's, buiten T8/T8b/T8c)
- [ ] Turret **cycle-groei** (×4671 per cycle) heractiveren + opnieuw ontwerpen — T8e zet de factor tijdelijk uit voor turret-schade
- [ ] Mineral-prijs-escalatie global over probes (nu per-probe, comment aanwezig)
- [ ] Balans-rebalance rond de economie ("we will rebalance around this eco later")

## 🔜 Open ideeën (niet gepland)
- [ ] `utils/keys.ts` verder uitrollen naar evt. nog resterende hard-coded keys
