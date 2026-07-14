# TODO — estado das fases

Rastreamento por fase para retomar de onde parou (doc-roadmap §6, §7.4).

## Fase 0 — Fundação ✅
- [x] Projeto Vite + TypeScript + Three.js
- [x] Estrutura de chunk 16×16×64 (`world/chunk.ts`)
- [x] Registro declarativo de blocos (`world/blocks.ts`)
- [x] Greedy meshing + oclusão de ambiente por vértice (`world/mesher.ts`)
- [x] Câmera 3ª pessoa com colisão + toggle 1ª pessoa (`core/camera.ts`)
- [x] Input teclado/mouse com pointer lock (`core/input.ts`)
- [x] Movimento WASD + colisão AABB + gravidade (`entities/player.ts`)
- [x] HUD, céu, névoa e iluminação suave

## Fase 1 — Mundo (próxima)
- [ ] `chunkManager.ts`: carregar/descarregar chunks ao redor do jogador
- [ ] `terrainGen.ts`: geração procedural por seed, biomas e cavernas (simplex-noise)
- [ ] Quebrar/colocar blocos (rebuild só do chunk modificado)
- [ ] Tela inicial com múltiplos mundos (criar/listar/carregar/excluir)
- [ ] Autosave em IndexedDB (apenas chunks modificados)

## Fase 2 — Sobrevivência
- [ ] Inventário + hotbar, dureza/ferramentas por tier, minérios, crafting, dia/noite

## Fase 3 — RPG
- [ ] Mobs com FSM e níveis, combate, XP/atributos, loot e raridades

## Fase 4 — Missões e mundo vivo
- [ ] Vila, NPCs, quests declarativas, quest log, boss regional

## Fase 5 — Polimento / futuro
- [ ] Áudio, partículas, minimapa, balanceamento, multiplayer LAN opcional
