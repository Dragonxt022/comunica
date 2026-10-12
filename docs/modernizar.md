# COMUNICA — Plano de modernização da interface

Objetivo: transformar o COMUNICA em uma plataforma de comunicação institucional com aparência de SaaS premium, navegação mais eficiente e experiência consistente no desktop e no celular, sem perder nenhuma funcionalidade existente.

A estratégia será de redesign progressivo, orientado pelo código atual. Primeiro identificamos a arquitetura e os componentes existentes; depois definimos o padrão visual e atualizamos as telas gradualmente, validando cada etapa.

## 1. Direção visual proposta

![Linear Dashboard Design by Prince Ojakorotu on Dribbble](https://images.openai.com/static-rsc-4/nQYWRy-7-bRCVoUQeAs9o9G3KLt_BH_oQPDRgygu-s_W25oy5UNGA2EbIkN5lXCfuYXbL9fzVg85qgf_A6y_-wqPKRThtRQaPUw7jj57H9BMw-hDVVYzXPzrn8p-35bNW7WLmWBYSYofDTEhHEMuQU9CocE6h06Unxj0zMkyk3U?purpose=inline)

Verificando se está nos Favoritos

Interface SaaS premium

Fundo claro, tipografia limpa, espaçamento consistente, superfícies discretas e azul como cor de ação. A interface deve transmitir organização e profissionalismo, sem excesso de efeitos, sombras ou elementos decorativos.

![Project Management Dashboard — Kanban View by Jason D on Dribbble](https://images.openai.com/static-rsc-4/E4iZrRONVxUaV_9xNsu218SKjH2G8c3ymwMZKZJ5hnCrDneLbFOZ08fMaxPBUHXUPfZL468FR6xtwIjyLUdlZuWg3BVQQ694-Bz-o3QvWDaky6DjJbyZe9C46wMtQW7cUOdzqDph_cZnHqA8kX6OU_opuarXvy1moVJA14hTMKs?purpose=inline)

Verificando se está nos Favoritos

Navegação compacta e recolhível

Sidebar expandida com ícones e nomes; recolhida com ícones, dicas de contexto e identificação clara da página ativa. No celular, navegação própria, adaptada ao toque.

![AutoIT Support App — built with AI on Blink](https://images.openai.com/static-rsc-4/w-F0XEatzWkDey44gUSF8iCqs8twDkN0MwTOPt_tkiLWBHGE8ZgVXfhkLWDRptgJ3IJnv5MEM-G_eUtkqzJHETz7sDqRl1OqDfdk-xEbnvYsR_zpec0p1EChbfccNJeLCAKJPJHWPNE4OfuwzOTzabfJ710xEdsPGrW9wmMw-BA?purpose=inline)

Verificando se está nos Favoritos

Conteúdo como protagonista

Solicitações com títulos legíveis, prazos e status fáceis de localizar, filtros organizados e ações contextuais. A informação será priorizada em vez de cercada por bordas e botões.

### Princípios que orientarão o redesign

* Clareza: cada tela deve ter uma ação principal e uma hierarquia de informações evidente.

* Consistência: botões, formulários, tabelas, menus, estados e modais seguirão as mesmas regras.

* Responsividade real: desktop e celular compartilharão os mesmos conceitos visuais, mas terão layouts apropriados a cada dispositivo.

* Funcionalidade preservada: a modernização não será uma reescrita dos fluxos de negócio.

* Acessibilidade: contraste adequado, navegação por teclado, foco visível, alvos de toque confortáveis e rótulos acessíveis.

* Desempenho: evitar bibliotecas pesadas e animações desnecessárias apenas para obter uma aparência moderna.

## 2. Diagnóstico técnico do repositório

Localizei o repositório do projeto: [Dragonxt022/comunica no GitHub](https://github.com/Dragonxt022/comunica).

O README e o layout principal mostram que não é necessário introduzir uma nova arquitetura de frontend para começar. O sistema já utiliza tecnologias adequadas para evoluir a interface progressivamente.

Frontend atual

EJS + Tailwind CSS via CDN + Alpine.js 3

Backend atual

Node.js + TypeScript + Express 4 + Sequelize 6

Layout compartilhado

`src/views/layouts/main.ejs`

Recursos que precisam continuar funcionando

Controle de acesso, múltiplos municípios, notificações, atualizações em tempo real, chat e módulos existentes.

### Um detalhe importante que encontrei

O layout `main.ejs` já implementa uma sidebar recolhível usando Alpine.js e `localStorage`. Portanto, não precisamos desenvolver essa funcionalidade do zero.

O problema é que ter uma sidebar recolhível não significa que toda a experiência de navegação esteja modernizada. Precisamos avaliar a integração entre o menu, o cabeçalho, o conteúdo, o mobile e os componentes de cada página.

Também manteria a arquitetura EJS e Alpine.js por enquanto. Migrar tudo para React ou Vue aumentaria o escopo e o risco sem ser necessário para atingir o resultado visual desejado.

## 3. Plano de implementação por fases

### Fase 1 — Auditoria da interface

Primeiro passo

Antes de alterar qualquer código

* Inspecionar `main.ejs`, CSS global e JavaScript de navegação.

* Identificar os templates EJS de dashboard, solicitações, calendário, planejamento e demais módulos.

* Mapear componentes duplicados e regras responsivas.

* Registrar interações, permissões e dependências de cada tela.

* Verificar como o projeto carrega Tailwind e Alpine em produção.

  Entrega: inventário técnico e mapa dos componentes a preservar.

### Fase 2 — Design system

* Definir cores, tipografia, espaçamentos, bordas e estados.

* Padronizar botões, campos, etiquetas, menus, tabelas, cartões e modais.

* Criar estilos compartilhados e evitar CSS específico repetido.

* Definir os pontos de adaptação para desktop, tablet e celular.

  Entrega: base visual reutilizável para todos os módulos.

### Fase 3 — Layout global

* Modernizar a sidebar expandida e recolhida.

* Simplificar o cabeçalho e organizar o contexto do município e o perfil.

* Ajustar a largura do conteúdo e o comportamento de rolagem.

* Preservar navegação por perfil, indicadores, notificações e chat.

* Melhorar o menu móvel sem interferir na navegação atual.

  Entrega: estrutura global modernizada, compartilhada entre as páginas.

### Fase 4 — Solicitações e dashboard

* Redesenhar a tabela, filtros, categorias e prioridades.

* Melhorar o contraste e a leitura de status e prazos.

* Rever o dashboard e a hierarquia dos indicadores.

* Criar uma apresentação de solicitações adequada ao celular.

* Preservar as visualizações Lista e Kanban e as ações existentes.

  Entrega: primeira área funcional completamente renovada.

### Fase 5 — Demais módulos

* Calendário e eventos.

* Releases e biblioteca de artes.

* Planejamento e indicadores.

* Inscrições e formulários.

* Relatórios, administração e configurações.

* Páginas públicas e formulários de inscrição, conforme os respectivos layouts.

  Entrega: identidade visual consistente em todo o COMUNICA.

### Fase 6 — Testes e validação

* Testar diferentes larguras de tela.

* Validar perfis de acesso e isolamento entre municípios.

* Conferir formulários, uploads, filtros, paginação e ações.

* Testar chat, notificações, atualização em tempo real e navegação.

* Executar `npm run lint` e testes funcionais disponíveis.

  Entrega: versão pronta para implantação após aprovação dos testes.

## 4. Como deve ficar a tela de Solicitações

Esta seria a primeira página que eu redesenharia porque reúne os problemas mais evidentes das capturas de tela.

# Solicitações

Gerencie e acompanhe as demandas da comunicação.

Nova solicitação

Em andamento

# 04

Pendentes

# 02

Concluídas

# 12

Buscar solicitações...

Todas

Nota

Release

Redes sociais

Arte gráfica

Vídeo

Card Dia das Crianças

#203 · Comunicação · Cujubim

Finalizado

Prioridade média

Aviso de feriado municipal

#202 · Secretaria de Saúde

Finalizado

Prazo: 09/10/2026

Wireframe ilustrativo. Números e exemplos são fictícios; a implementação utilizará os dados reais e os campos já existentes.

A proposta acima ilustra a hierarquia, não o desenho final em pixels. No desktop, as solicitações continuariam disponíveis em tabela, com as colunas necessárias e sem quebras de texto excessivas. No celular, a mesma informação seria reorganizada em cartões.

Importante: os indicadores de resumo só devem ser adicionados se os dados e as consultas existentes sustentarem esses números. Não criaria métricas artificiais apenas para preencher espaço.

## 5. Regras para preservar as funcionalidades

Durante a implementação, estabeleceria estas restrições:

1. Não alterar rotas, contratos de formulários ou métodos HTTP sem necessidade comprovada.

2. Não remover verificações de permissão ou condições EJS que controlam a visibilidade dos módulos.

3. Não alterar modelos Sequelize, estrutura do banco ou regras de negócio para resolver problemas exclusivamente visuais.

4. Preservar os identificadores HTML utilizados por scripts, tours de onboarding, notificações e atualizações dinâmicas, ou atualizar todas as dependências correspondentes.

5. Manter chat, push notifications, SSE, uploads, impressão e exportações funcionando.

6. Não substituir o sistema de estilos inteiro antes de verificar as dependências do Tailwind CDN e a compatibilidade dos templates existentes.

7. Trabalhar em uma branch própria, com alterações pequenas e reversíveis.

## 6. Critérios para considerar o redesign concluído

| Critério       | Resultado esperado                                              |
| -------------- | --------------------------------------------------------------- |
| Aparência      | Linguagem visual consistente em todas as páginas                |
| Responsividade | Sem rolagem horizontal indevida ou conteúdo cortado             |
| Navegação      | Sidebar e menu móvel funcionam corretamente                     |
| Dados          | Consultas, filtros e resultados mantêm o comportamento anterior |
| Permissões     | Cada perfil continua vendo somente o que lhe compete            |
| Interações     | Chat, notificações, modais e formulários funcionam              |
| Qualidade      | TypeScript validado e testes funcionais aprovados               |
| Implantação    | Alterações versionadas e procedimento de reversão disponível    |

## 7. Próxima etapa recomendada

Eu começaria pela auditoria completa dos templates e componentes, seguida da implementação do design system e do layout global. O repositório já indica uma estrutura organizada por módulos e um layout compartilhado, o que favorece essa abordagem.

Os arquivos de referência são:

* [Layout principal — `main.ejs`](https://github.com/Dragonxt022/comunica/blob/main/src/views/layouts/main.ejs)

* [Configuração de dependências — `package.json`](https://github.com/Dragonxt022/comunica/blob/main/package.json)

* [Documentação e estrutura do projeto — `README.md`](https://github.com/Dragonxt022/comunica/blob/main/README.md)

O código do layout já foi inspecionado, mas ainda não fiz uma auditoria completa de todos os templates nem alterei arquivos do repositório. Essa inspeção deve preceder as modificações, principalmente para identificar os estilos locais, scripts e comportamentos específicos de cada módulo.

A recomendação final é modernizar a interface existente, e não trocar a tecnologia do projeto. Isso reduz o risco, aproveita o trabalho que você já fez e permite entregar melhorias visíveis desde a primeira etapa.
