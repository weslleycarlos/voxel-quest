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

### Revisão pós-Fase 2 (bugs corrigidos)
- [x] **Colocar blocos parava de funcionar**: ao fechar o inventário (E), o pointer lock era pedido em `document.body` em vez do canvas — o `Input` nunca voltava a reconhecer cliques. Agora o HUD reengaja o lock via canvas (`hud.ts` + `main.ts`).
- [x] Menu de pausa aparecia por cima do inventário ao abrir com E (o exit do pointer lock era tratado como pausa).
- [x] **Personagem "boneco duro" e flutuando**: o modelo antigo não tinha nada entre y=0 e y=0.6 (parecia sem aderência ao chão) e não animava. Reescrito com membros articulados (pivô em ombro/quadril), balanço de andar proporcional à velocidade, bob do corpo, pose no ar e rotação suavizada (`entities/playerModel.ts`).

## Fase 3 — RPG ✅
- [x] `entities/mob.ts`: classe base com FSM (idle → wander → chase → attack → dead), física AABB voxel, knockback, flash de dano e barra de vida + nome/nível flutuante
- [x] `entities/mobTypes.ts`: mobs declarativos — Slime (dia/noite, pula), Esqueleto (noite/cavernas), Golem de Pedra (cavernas) — com stats escalando por nível
- [x] `entities/spawner.ts`: spawn em anel ao redor do jogador respeitando dia/noite e profundidade; nível cresce com a distância da origem; cap, despawn por distância
- [x] `entities/combat.ts`: dano do jogador (arma + força, chance de crítico) e números de dano flutuantes (sprites)
- [x] Ataque com clique esquerdo prioriza mob na mira sobre mineração (alcance 3.2)
- [x] XP/nível/atributos: curva de XP, level up dá +4 HP máx e +força; regen lenta fora de combate; morte → respawn no spawn inicial
- [x] `items/lootTables.ts`: loot por mob com raridades (comum/incomum/raro/épico) e aviso colorido no HUD
- [x] Espadas por tier (madeira → arcana) com receitas 2×2 e dano próprio; drops novos: gosma, osso
- [x] HUD: barra de vida, barra de XP + nível, toasts (loot/level up/morte), vinheta de dano
- [x] Stats do jogador salvos no IndexedDB (compatível com saves antigos)

### Pendências conhecidas (Fase 3)
- [ ] Mobs não persistem no save (respawnam ao recarregar)
- [ ] Esqueleto ataca corpo-a-corpo (sem projéteis)
- [ ] Sem spawn baseado em luz real (usa hora do dia + profundidade)

## Fase 4 — Missões e mundo vivo
- [ ] **Introdução com contexto/história**: abertura com texto/legendas no primeiro spawn do mundo (quem você é, onde está, objetivo inicial), pulável — o jogador não deve mais "aparecer no meio do nada" (doc §6 Fase 4)
- [ ] Vila, NPCs, quests declarativas, quest log, boss regional (diálogos reutilizam o sistema de legendas da intro)

## Fase 5 — Polimento / futuro
- [ ] Áudio, partículas, minimapa, balanceamento, multiplayer LAN opcional
