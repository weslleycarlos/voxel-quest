# Voxel Quest

Jogo de blocos 3D estilo Minecraft com mecânicas de RPG/Arcade/MMORPG.
Stack: **Three.js + TypeScript + Vite** (Opção A do `doc-roadmap`).

## Fase 0 — Fundação ✅

Primeira milestone jogável:

- Projeto **Vite + TypeScript + Three.js**.
- **Um chunk** (16×16×64) renderizado com **greedy meshing** e **oclusão de
  ambiente por vértice** (1 draw call, cores/iluminação assadas).
- **Câmera 3ª pessoa** com colisão contra voxels, e alternância para **1ª pessoa**.
- **Movimento WASD** com **colisão AABB** própria e **gravidade** (pulo, corrida).
- Elementos visuais: céu em gradiente, névoa, luz hemisférica + direcional,
  sombreamento direcional por face e textura de detalhe pixel-art.

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
| Espaço | Pular |
| Shift | Correr |
| Mouse | Olhar (após clicar em "Entrar no mundo") |
| V | Alternar 1ª / 3ª pessoa |
| ESC | Liberar o cursor (pausa) |

## Estrutura (conforme `doc-roadmap` §3)

```
src/
  core/    main.ts · input.ts · camera.ts
  world/   chunk.ts · blocks.ts · mesher.ts · textures.ts
  entities/player.ts · playerModel.ts
  ui/      hud.ts · style.css
```

Veja `TODO.md` para o estado de cada fase.
