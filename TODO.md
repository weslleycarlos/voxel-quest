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

## Fase 4 — Missões e mundo vivo ✅
- [x] **Introdução com contexto/história**: abertura com 4 legendas sequenciais no primeiro spawn do mundo (contexto, objetivo, direção da vila), puláveis com clique — salva `introShown` no player save
- [x] **Vila no spawn**: estruturas de 3 casas + caminho construídas via `setBlock` no chunk de spawn (`quests/village.ts`)
- [x] **NPCs**: 3 personagens (Ancião, Ferreiro, Guarda) com modelos de cubos, nomes flutuantes e diálogos por estado da quest (`quests/npcs.ts`)
- [x] **Diálogos de NPC**: interação por proximidade (tecla F) mostra legendas sequenciais; reutiliza o mesmo sistema da introdução
- [x] **Sistema de quests declarativo**: 5 quests tutorial + boss (`quests/quest.ts`) com objetivos `collect/kill/craft/talk/explore`
- [x] **Quest log + HUD**: painel aberto com tecla L, lista missões ativas com progresso em tempo real (`ui/hud.ts`)
- [x] **Progressão automática**: eventos `blockMined`, `mobKilled`, `itemCrafted`, `npcTalk` avançam objetivos; recompensas (XP/itens) entregues ao completar
- [x] **Boss regional**: Golem Ancião (`ancient_golem`) posicionado fixo a ~180m ao norte, com 80 HP, 8 de dano e loot de cristais
- [x] **Persistência**: estado de quests (`questLogSave`) e `introShown` salvos no IndexedDB junto com o jogador
- [x] **Missões diárias**: geração procedural (`generateDaily`) com objetivos aleatórios

### Revisão pós-Fase 4 (bugs corrigidos)
- [x] **Cadeia de quests travada**: `intro_welcome` exigia o evento `biomeEntered("spawn")`, que nunca era emitido — nenhuma quest seguinte destravava. Agora o evento dispara ao andar ~20 blocos do spawn, e mudanças de bioma também emitem `biomeEntered` (para futuras quests de exploração).
- [x] **NPCs enterrados e inalcançáveis**: eram posicionados com `y=0` (superfície fica em y≈30+), então nunca apareciam e a checagem de distância 3D da tecla F nunca passava. Agora ficam sobre `surfaceY` e a interação usa distância horizontal.
- [x] **Legendas quebravam no 2º mundo**: `stopWorld()` chamava `captions.dispose()` num objeto global; ao entrar em outro mundo o overlay não existia mais. Substituído por `captions.hide()`.
- [x] **Quests vazavam entre mundos**: `fromSave(undefined)` retornava sem limpar o estado do mundo anterior — mundo novo herdava progresso do antigo. `fromSave` agora sempre limpa.
- [x] **Missões diárias mortas**: `refreshDaily` nunca era chamado, e a diária não sobrevivia ao save (id gerado não existia em `QUESTS`). Agora é gerada no início do mundo, salva por inteiro (`daily` no save), tem id por data real e é descartada/regerada quando o dia vira.
- [x] **Evento `npcTalk` nunca emitido** ao falar com NPC — objetivos `talk` eram impossíveis.
- [x] Recompensa duplicada: `tutorial_kill` dava espada de madeira, que o jogador já recebe no kit inicial → agora dá espada de pedra.
- [x] Quest log e diária mostravam ids crus (`stone`, `slime`) → nomes legíveis via `targetName()`.
- [x] Diálogos `_before` de quests ativas eram inalcançáveis (só `_during` era buscado) → fallback `_during` → `_before`.
- [x] Texto da intro dizia "vila ao leste", mas a vila é construída no próprio spawn → texto corrigido e instrui a tecla F.

### Pendências conhecidas (Fase 4)
- [ ] NPCs não têm IA de movimento (estáticos)
- [ ] Sem mapa/minimapa apontando a vila
- [ ] Boss não tem mecânica especial além de stats elevados
- [ ] Objetivo `collect` conta blocos minerados, não itens no inventário (não há "entrega" real ao NPC)
- [ ] Vila é reconstruída via `setBlock` a cada carga do mundo (marca chunks como modificados; idempotente, mas incha o save)
- [ ] Boss não persiste: renasce com HP cheio ao recarregar o mundo (quest completa evita re-farm)
- [ ] Tochas da vila são blocos de minério de ouro (placeholder)

## Fase 5 — Polimento / futuro
- [ ] Áudio, partículas, minimapa, balanceamento, multiplayer LAN opcional
