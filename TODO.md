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

## Fase 1 — Mundo ✅
- [x] `chunkManager.ts`: carregar/descarregar chunks ao redor do jogador (raio 6, fila por distância, orçamento por frame)
- [x] `terrainGen.ts`: geração procedural por seed (simplex-noise), 4 biomas (planície/floresta/deserto/montanha) e cavernas 3D
- [x] Quebrar/colocar blocos com raycast DDA, destaque do bloco mirado e rebuild só do chunk modificado (+vizinhos de borda)
- [x] Hotbar simplificada de blocos (teclas 1–7)
- [x] Tela inicial com múltiplos mundos (criar com nome+seed, listar, carregar, excluir) — `screens/titleScreen.ts`
- [x] Autosave em IndexedDB (30 s, pausa e beforeunload; apenas chunks modificados) — `save/`
- [x] Água deixou de ser sólida: fluido com física de nado (afundar devagar, espaço nada, overlay submerso)

### Pendências conhecidas (Fase 1)
- [ ] Geração de terreno em Web Worker (doc §5) — hoje é na main thread com orçamento de 2 chunks/frame
- [ ] Renomear mundo na tela inicial (doc §4.8 menciona; não era item do roadmap §6)
- [ ] Água dinâmica (fluxo/espalhamento) — fora do escopo do doc

## Fase 2 — Sobrevivência ✅
- [x] Registro declarativo de itens (`items/item.ts`) separado dos blocos
- [x] Inventário em grade 3×9 + hotbar de 9 slots (`items/inventory.ts`)
- [x] Hotbar com teclas 1–9 e scroll do mouse
- [x] Blocos com `hardness`, `tool` e `minTier` (dureza + ferramenta por tier)
- [x] Mineração contínua (segurar botão esquerdo) com progresso e overlay de rachadura
- [x] Ferramentas por tier: madeira → pedra → ferro → ouro → arcano
- [x] Minérios por profundidade: carvão, ferro, ouro, cristal arcano
- [x] Drops de blocos convertidos em itens (ex.: pedra → pedregulho, madeira → log)
- [x] Colocação de blocos via item selecionado na hotbar
- [x] Crafting manual 2×2 aberto com E + receitas declarativas (`items/crafting.ts`)
- [x] Ciclo dia/noite com paleta de cores, iluminação e relógio no HUD
- [x] Salvamento do inventário em IndexedDB
- [x] Kit inicial ao criar novo mundo (picareta de madeira + blocos)

## Fase 3 — RPG
- [ ] Mobs com FSM e níveis, combate, XP/atributos, loot e raridades

## Fase 4 — Missões e mundo vivo
- [ ] Vila, NPCs, quests declarativas, quest log, boss regional

## Fase 5 — Polimento / futuro
- [ ] Áudio, partículas, minimapa, balanceamento, multiplayer LAN opcional
