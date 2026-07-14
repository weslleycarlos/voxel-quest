# Voxel Quest

Jogo de blocos 3D estilo Minecraft com mecânicas de RPG/Arcade/MMORPG, desenvolvido seguindo o doc-roadmap.

## Stack Tecnológica

- **Engine 3D**: Three.js
- **Linguagem**: TypeScript
- **Bundler**: Vite
- **Geração de Terreno**: simplex-noise
- **Física**: Colisão AABB própria (voxel)

## Estrutura do Projeto

```
/src
  /core
    main.ts            # Bootstrap e game loop
    input.ts           # Teclado/mouse (WASD, pulo, ataque)
  /world
    chunk.ts           # Estrutura de chunk 16x16x64
    chunkManager.ts    # Carrega/descarrega chunks
    terrainGen.ts      # Geração procedural com biomas
    mesher.ts          # Greedy meshing para otimização
    blocks.ts          # Registro de blocos
  /entities
    player.ts          # Movimento, vida, XP, nível
    mob.ts             # Inimigos com níveis
  /items
    inventory.ts       # Inventário e hotbar
  /quests
    quest.ts           # Sistema de missões
  /ui
    hud.ts             # Interface do usuário
  /save
    saveManager.ts     # Persistência de dados
```

## Como Rodar

### Desenvolvimento

```bash
cd voxel-quest
npm install
npm run dev
```

Acesse `http://localhost:5173` no navegador.

### Build de Produção

```bash
npm run build
```

Os arquivos serão gerados na pasta `dist/`.

## Controles

- **WASD**: Movimentar
- **SPACE**: Pular
- **Mouse**: Olhar ao redor (clique para travar o cursor)

## Roadmap (Fases)

### Fase 0 — Fundação ✅
- [x] Projeto Vite + Three.js configurado
- [x] Chunk único renderizado
- [x] Câmera e movimento WASD com colisão e gravidade
- [x] Geração procedural de terreno
- [x] Greedy meshing implementado

### Fase 1 — Mundo
- [ ] ChunkManager com carregamento dinâmico completo
- [ ] Terreno com biomas e cavernas
- [ ] Quebrar/colocar blocos
- [ ] Tela inicial com múltiplos mundos
- [ ] Save system com IndexedDB

### Fase 2 — Sobrevivência básica
- [ ] Inventário + hotbar
- [ ] Dureza de blocos e ferramentas por tier
- [ ] Minérios por profundidade
- [ ] Crafting simples
- [ ] Ciclo dia/noite

### Fase 3 — RPG
- [ ] Mobs com máquina de estados e níveis
- [ ] Combate com knockback e dano flutuante
- [ ] XP/nível/atributos do jogador
- [ ] Loot tables e raridades

### Fase 4 — Missões e mundo vivo
- [ ] Vila com NPCs
- [ ] Sistema de quests declarativo
- [ ] Quest log
- [ ] Primeiro boss regional

### Fase 5 — Polimento / futuro
- [ ] Áudio
- [ ] Partículas
- [ ] Minimapa
- [ ] Multiplayer LAN (opcional)

## Performance

O jogo é otimizado para rodar em máquinas sem GPU dedicada:

- Greedy meshing reduz drasticamente o número de triângulos
- Distância de renderização configurável (padrão: 4 chunks)
- Texturas em atlas único
- Sem sombras dinâmicas na v1
- Meta: 60 FPS em GPU integrada Intel UHD

## Licença

ISC
