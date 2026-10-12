# Estúdio de Artes — operação e arquitetura

Gerador determinístico de artes institucionais do COMUNICA. Rota base: `/artes`.

## Conceitos

- **Modelo (template):** metadados + campos dinâmicos + variantes de layout, versionado.
- **Variante:** composição concreta por formato/papel (`9:16`, `3:4`, `capa`, `interna`, `final`).
- **Ativo:** imagem, ícone, fundo, forma ou componente reutilizável (biblioteca de elementos).
- **Paleta:** cores semânticas (`primary`, `secondary`, `text`, ...).
- **Estilo:** tipografia reutilizável (família, tamanho, mínimo, limite de linhas, overflow).
- **Geração:** resultado da composição, com validações e arquivos, vinculado à solicitação de origem.

A IA atua **somente no texto** (revisão e divisão de carrossel). A composição visual é sempre
determinística a partir do template.

## Operações administrativas (admin / secom / super_admin)

- **Modelos** (`/artes/modelos`): criar, editar no editor visual, duplicar, **publicar** e arquivar.
  - Publicar exige ao menos uma variante com elementos.
  - Editar um modelo publicado cria nova versão; artes antigas não são alteradas.
- **Elementos** (`/artes/ativos`): enviar arquivos (JPEG/PNG/GIF/WebP/SVG), categorizar, arquivar.
- **Paletas e estilos** (`/artes/paletas`): criar/editar paletas semânticas e estilos tipográficos.

## Produção (`/artes/producao`)

1. Escolha um modelo publicado (ou abra a partir de uma solicitação).
2. Modalidade: **9:16**, **9:16 + 3:4** ou **carrossel 3:4**.
3. Preencha os campos; a **prévia** é recomposta em tempo real (SVG).
4. A IA pode revisar textos e sugerir a divisão do carrossel; datas/horários/local são preservados.
5. **Gerar arte**: valida cada página/formato e rasteriza PNGs (1080×1920 e/ou 1080×1440).
6. **Aprovar**: bloqueadores impedem a aprovação; avisos exigem conferência.
   Ao aprovar, os PNGs são anexados à solicitação de origem (Biblioteca de Artes).

## Isolamento e permissões

- Toda consulta filtra por `municipio_id` via `municipioWhere`/`getActiveMid`.
- Ações de administração exigem papel `admin`, `secom` ou `super_admin`.
- Uploads de ativos aceitam apenas os MIME types da lista permitida; referências fora de
  `public/uploads/` são ignoradas na composição.

## Arquitetura técnica

- **Composição:** `src/lib/artes/composicao.ts` (SVG puro, determinístico).
- **Texto:** `src/lib/artes/texto.ts` (quebra de linha e ajuste por limites mínimos).
- **Paletas:** `src/lib/artes/paletas.ts` (cores semânticas e contraste WCAG).
- **Validação:** `src/lib/artes/validacao.ts` (bloqueadores × avisos).
- **Render:** `src/lib/artes/render.ts` (SVG → PNG via `sharp`; fallback para SVG se falhar).
- **Modelos:** `src/database/models/Arte*.ts`.
- **HTTP:** `src/modules/artes/{routes,controller}.ts`; views em `src/views/artes/`.

## Testes

`npm test` executa `tests/artes.test.ts` (quebra de linha, ajuste de texto, composição
determinística, validação de campos/imagens, contraste e render PNG).

## Fora do escopo desta versão

Geração livre de imagens por IA, animações/vídeo, colaboração em tempo real, marketplace de
templates e publicação automática em redes sociais.
