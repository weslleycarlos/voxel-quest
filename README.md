# Voxel Quest

Jogo de blocos 3D estilo Minecraft com mecânicas de RPG/Arcade/MMORPG.
Stack: **Three.js + TypeScript + Vite** (Opção A do `doc-roadmap`).

## Fase 2 — Sobrevivência ✅

Milestone atual jogável:

- Projeto **Vite + TypeScript + Three.js**.
- **Mundo procedural** com chunks dinâmicos, greedy meshing, AO por vértice,
  biomas, cavernas e geração por seed.
- **Inventário + hotbar** de itens (teclas 1–9, scroll do mouse).
- **Mineração com dureza** e ferramentas por tier (madeira → pedra → ferro →
  ouro → arcano).
- **Minérios por profundidade**: carvão, ferro, ouro e cristal arcano.
- **Crafting manual 2×2** aberto com a tecla **E**.
- **Ciclo dia/noite** com paleta de cores, iluminação dinâmica e relógio no HUD.
- Salvamento em IndexedDB: jogador, inventário e apenas chunks modificados.

## Como rodar

```bash
npm install
npm run dev      # abre o jogo no navegador (Vite)
```

Build de produção:

```bash
npm run build    # typecheck (tsc) + bundle (vite)
npm run preview
```

## Controles

| Tecla | Ação |
|---|---|
| WASD | Mover |
| Espaço | Pular / nadar para cima |
| Shift | Correr |
| Mouse | Olhar (após clicar em "Entrar no mundo") |
| Clique esquerdo (segurar) | Quebrar bloco |
| Clique direito | Colocar bloco selecionado |
| 1–9 | Selecionar slot da hotbar |
| Scroll | Trocar item da hotbar |
| E | Abrir inventário / crafting |
| V | Alternar 1ª / 3ª pessoa |
| ESC | Liberar o cursor (pausa) |

## Estrutura (conforme `doc-roadmap` §3)

```
src/
  core/    main.ts · input.ts · camera.ts
  world/   chunk.ts · chunkManager.ts · blocks.ts · mesher.ts ·
           terrainGen.ts · textures.ts · dayNight.ts
  entities/player.ts · playerModel.ts
  items/   item.ts · inventory.ts · crafting.ts
  save/    db.ts · saveManager.ts · worldRegistry.ts
  screens/ titleScreen.ts
  ui/      hud.ts · style.css
```

Veja `TODO.md` para o estado de cada fase.
