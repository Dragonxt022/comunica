# PR — Gerador de Artes Institucionais com Editor Visual, Biblioteca de Elementos e Assistência Textual por IA

**Projeto:** COMUNICA  
**Tipo:** Nova funcionalidade  
**Prioridade:** Alta  
**Objetivo:** Criar um sistema integrado para montar, personalizar, validar, aprovar e armazenar artes institucionais, com modelos reutilizáveis, identidade visual consistente e geração determinística.

---

## 1. Contexto e problema

O COMUNICA precisa de uma funcionalidade que facilite a produção de banners institucionais para redes sociais, comunicados, avisos, campanhas públicas, eventos e demais demandas da comunicação municipal.

Atualmente, a produção de cada arte pode exigir montagem manual, ajustes repetitivos de texto, adaptação de formatos e conferência visual. Isso aumenta o tempo de produção e dificulta manter um padrão consistente entre os materiais.

A proposta é criar um **sistema próprio de criação de artes, com experiência visual inspirada em editores como o Canva, mas orientado por modelos, componentes reutilizáveis e regras institucionais**.

O sistema não deve ser apenas um formulário que preenche um banner fixo. Também não deve permitir que qualquer usuário altere livremente todos os elementos e comprometa a identidade visual.

A solução deve combinar:

- Biblioteca centralizada de modelos, imagens, ícones, fundos e elementos gráficos.
- Editor visual administrativo para criar, configurar e versionar modelos.
- Editor de produção simplificado para o uso cotidiano.
- Sistema de paletas de cores e tipografia.
- Motor determinístico de composição e renderização.
- Assistência textual por IA para correção, organização e adaptação do conteúdo.
- Validação automática de legibilidade, dimensões, sobreposições e conteúdo.
- Integração com o fluxo de Solicitações e com a Biblioteca de Artes existente.

## 2. Princípio arquitetural obrigatório

A geração das artes deve ser baseada em **templates determinísticos**, não em geração visual livre por IA.

A IA será utilizada exclusivamente como assistente de texto nesta funcionalidade. Ela poderá ajudar a melhorar o conteúdo escrito, mas não será responsável por decidir livremente o design final.

### 2.1. Responsabilidades de cada componente

| Componente | Responsabilidade |
|---|---|
| IA textual | Corrigir ortografia, gramática, semântica, clareza, dicção e estrutura do texto. |
| Biblioteca de elementos | Armazenar imagens, ícones, fundos, formas, texturas e componentes reutilizáveis. |
| Sistema de identidade visual | Definir paletas, tipografias, hierarquia visual, contrastes e regras de uso. |
| Editor de modelos | Permitir montar e configurar layouts visuais reutilizáveis. |
| Motor de composição | Posicionar os elementos e preencher os campos conforme as regras do modelo. |
| Motor de renderização | Exportar a composição para o formato final de imagem. |
| Validador | Identificar cortes, textos ilegíveis, sobreposições e problemas técnicos. |
| Biblioteca de Artes | Armazenar os materiais gerados, aprovados e suas versões. |

### 2.2. Fluxo geral

1. O usuário seleciona uma solicitação ou inicia uma nova arte.
2. O sistema identifica o tipo de demanda e apresenta modelos compatíveis.
3. O usuário escolhe um modelo visual.
4. O conteúdo textual é preenchido manualmente ou tratado com assistência da IA.
5. O usuário revisa e confirma o texto.
6. O motor determinístico compõe a arte utilizando o modelo, os elementos e as regras cadastradas.
7. O validador verifica a composição.
8. O usuário visualiza a prévia e realiza os ajustes permitidos.
9. A arte é aprovada e exportada.
10. O material é armazenado na Biblioteca de Artes, mantendo a relação com a solicitação de origem.

O fluxo deverá permitir geração sem IA. Se o provedor de IA estiver indisponível, o usuário continuará podendo produzir a arte normalmente.

---

## 3. Modalidades de geração

A funcionalidade deve oferecer três modalidades de saída.

### 3.1. Opção 1 — Somente formato 9:16

Gerar uma arte vertical destinada prioritariamente a Stories, Reels e conteúdos verticais.

- Proporção: 9:16.
- Dimensão padrão: 1080 × 1920 px.
- Seleção de modelos compatíveis com esse formato.
- Prévia individual.
- Exportação em PNG.
- Possibilidade de utilizar o material em outras plataformas compatíveis.

### 3.2. Opção 2 — Formatos 9:16 e 3:4

Gerar duas versões da mesma arte, uma para cada proporção.

- Versão 9:16: 1080 × 1920 px.
- Versão 3:4: 1080 × 1440 px.
- Compartilhamento do mesmo conteúdo textual.
- Aplicação de layouts e regras específicas para cada formato.
- Prévia independente de cada versão.
- Validação e aprovação das duas saídas.

**Não realizar apenas um redimensionamento automático da imagem original.**

O sistema deverá utilizar uma variante específica do modelo para cada formato ou executar uma adaptação estrutural definida no template. A posição, a dimensão e a hierarquia dos elementos devem ser ajustadas para manter a composição equilibrada.

Se o modelo não possuir uma variante compatível, o sistema deverá informar a limitação e solicitar a escolha de outro modelo ou a configuração da variante faltante.

### 3.3. Opção 3 — Carrossel no formato 3:4

Gerar uma sequência de artes relacionadas, formando um carrossel.

- Proporção de cada página: 3:4.
- Dimensão padrão de cada página: 1080 × 1440 px.
- Quantidade de páginas configurável dentro dos limites definidos pelo sistema.
- Conteúdo textual distribuído entre as páginas.
- Consistência visual entre todas as páginas.
- Numeração opcional.
- Capa com hierarquia visual específica.
- Páginas internas com layouts compatíveis com o conteúdo.
- Página final opcional com chamada para ação, contato ou orientação institucional.

O sistema não deverá simplesmente dividir o texto por quantidade de caracteres. A distribuição deve considerar o sentido do conteúdo, os títulos, os subtítulos e os blocos informativos.

A IA poderá sugerir a divisão do texto em páginas, mas a estrutura final deverá ser validada pelo usuário antes da renderização.

Cada página deverá ser validada individualmente, além da validação do conjunto.

---

## 4. Editor visual semelhante ao Canva, mas orientado por modelos

O COMUNICA deverá possuir dois ambientes diferentes: um para administrar os modelos e outro para produzir artes.

### 4.1. Editor administrativo de modelos

Destinado aos usuários autorizados a criar, editar, testar e publicar modelos.

O editor deverá permitir:

- Criar um modelo a partir de uma tela vazia ou de um modelo existente.
- Definir dimensões e proporção.
- Inserir imagens, fundos, ícones, formas e elementos gráficos.
- Adicionar textos fixos e campos de conteúdo dinâmico.
- Posicionar e redimensionar elementos.
- Alinhar elementos e utilizar guias visuais.
- Controlar camadas e ordem de sobreposição.
- Configurar margens, espaçamentos e áreas seguras.
- Aplicar paletas de cores e estilos tipográficos.
- Definir áreas editáveis e elementos bloqueados.
- Configurar regras de comportamento dos textos.
- Criar variantes para formatos diferentes.
- Visualizar a arte em tempo real.
- Testar conteúdos curtos e longos.
- Salvar rascunhos, publicar versões e arquivar modelos.

O editor não precisa reproduzir todos os recursos do Canva. Deve priorizar as ferramentas necessárias à criação de templates institucionais.

### 4.2. Editor de produção

Destinado à produção cotidiana das artes.

O operador deverá conseguir:

- Escolher um modelo publicado.
- Preencher os campos de conteúdo.
- Informar datas, horários, locais, contatos e outras informações.
- Substituir imagens nos espaços autorizados.
- Solicitar revisão textual por IA.
- Visualizar o resultado.
- Alterar textos e imagens permitidos.
- Selecionar variantes de layout disponíveis.
- Conferir os formatos gerados.
- Aprovar ou devolver para ajustes.
- Salvar a arte na Biblioteca de Artes.

Elementos institucionais protegidos, como logotipos, assinaturas oficiais e componentes obrigatórios, não deverão ser removidos por usuários sem permissão específica.

### 4.3. Níveis de liberdade

O sistema deverá diferenciar:

- **Elementos bloqueados:** não podem ser modificados no fluxo de produção.
- **Elementos editáveis:** podem ser alterados por usuários autorizados.
- **Elementos dinâmicos:** recebem valores de campos da solicitação.
- **Elementos opcionais:** aparecem somente quando existe conteúdo associado.
- **Elementos condicionais:** são exibidos conforme regras definidas no modelo.

Isso permite variedade visual sem perder o padrão institucional.

---

## 5. Biblioteca de elementos visuais

Criar uma biblioteca centralizada para armazenar e reutilizar recursos gráficos.

### 5.1. Categorias de ativos

**Fundos e imagens**
- Fotografias institucionais.
- Imagens de obras e serviços públicos.
- Fotografias de eventos.
- Paisagens e imagens locais.
- Texturas e fundos abstratos.
- Fundos com gradientes.
- Imagens decorativas.

**Formas e elementos gráficos**
- Círculos, linhas e retângulos.
- Formas geométricas.
- Recortes diagonais.
- Molduras.
- Divisores.
- Blocos de destaque.
- Formas orgânicas.
- Sombras e máscaras.
- Elementos decorativos discretos.

**Ícones e símbolos**
- Saúde.
- Educação.
- Obras e infraestrutura.
- Agricultura.
- Esporte.
- Cultura.
- Meio ambiente.
- Serviços públicos.
- Alertas e comunicados.
- Transporte e mobilidade.

Utilizar preferencialmente ícones vetoriais de uma mesma família visual, evitando misturar estilos incompatíveis.

**Componentes informativos**
- Cabeçalho institucional.
- Título e subtítulo.
- Etiqueta de data.
- Bloco de horário.
- Endereço e localização.
- Chamada para ação.
- Aviso de urgência.
- Rodapé institucional.
- Assinatura da secretaria responsável.
- Logotipo e marcas oficiais.

### 5.2. Metadados dos elementos

Cada ativo deverá possuir, quando aplicável:

- Identificador.
- Nome.
- Categoria.
- Descrição.
- Arquivo ou referência ao arquivo.
- Formato.
- Dimensões.
- Tags de pesquisa.
- Paleta ou estilo compatível.
- Situação: rascunho, publicado ou arquivado.
- Autor e datas de criação e atualização.
- Permissões de uso.
- Texto alternativo para imagens.
- Indicação de uso institucional, quando pertinente.

Os arquivos devem utilizar o sistema de armazenamento já adotado pelo projeto, respeitando suas políticas de acesso e isolamento entre municípios.

### 5.3. Reutilização e governança

O sistema deverá evitar a duplicação desnecessária de imagens e componentes.

Quando um elemento for utilizado por um modelo publicado, sua alteração não deverá modificar silenciosamente artes antigas ou mudar a aparência de modelos históricos.

Modelos publicados devem referenciar versões identificáveis dos ativos ou utilizar um mecanismo equivalente de versionamento e imutabilidade.

---

## 6. Sistema de cores e identidade visual

A combinação de cores deverá ser organizada por regras, e não escolhida aleatoriamente durante cada geração.

### 6.1. Paletas semânticas

Cada paleta deverá definir funções para as cores:

- `primary`: cor principal.
- `secondary`: cor de apoio.
- `accent`: cor de destaque.
- `background`: fundo.
- `surface`: superfície de cartões ou áreas informativas.
- `text`: texto principal.
- `mutedText`: texto secundário.
- `border`: bordas e divisores.
- `success`: indicação positiva.
- `warning`: atenção.
- `danger`: alerta crítico.

As cores de estado devem ser utilizadas de forma consistente e não substituir automaticamente a identidade visual do município.

### 6.2. Exemplo de paleta

Os valores abaixo são apenas ilustrativos para demonstrar a estrutura; não constituem uma definição da identidade visual oficial.

| Função | Cor ilustrativa |
|---|---|
| Principal | `#17365D` |
| Secundária | `#2878B5` |
| Destaque | `#F2B544` |
| Fundo | `#F3F5F7` |
| Texto | `#202833` |

### 6.3. Regras de aplicação

- Cada modelo deverá declarar qual paleta utiliza.
- Elementos poderão utilizar cores semânticas da paleta, em vez de valores arbitrários.
- O editor poderá oferecer variações previamente aprovadas.
- O sistema deverá validar o contraste entre texto e fundo.
- O modelo deverá definir quais combinações são permitidas.
- Alertas importantes deverão ter contraste e hierarquia visual adequados.
- Logotipos e cores institucionais protegidos deverão respeitar as regras configuradas.
- A geração não poderá alterar livremente a identidade visual apenas para acomodar o conteúdo.

### 6.4. Paletas temáticas

Permitir a criação de paletas ou variações aprovadas para categorias como:

- Saúde.
- Educação.
- Obras e infraestrutura.
- Agricultura.
- Esporte e cultura.
- Eventos.
- Comunicados.
- Alertas e avisos urgentes.

Uma paleta temática poderá alterar os destaques e elementos complementares sem comprometer as cores institucionais obrigatórias.

---

## 7. Tipografia e hierarquia visual

O sistema deverá permitir definir estilos tipográficos reutilizáveis.

Cada estilo poderá configurar:

- Família tipográfica.
- Peso.
- Tamanho inicial.
- Tamanho mínimo permitido.
- Altura de linha.
- Espaçamento entre letras.
- Alinhamento.
- Cor.
- Limite de linhas.
- Margens internas.
- Comportamento em caso de excesso de conteúdo.

Estilos recomendados:

- Título principal.
- Subtítulo.
- Texto informativo.
- Destaque numérico.
- Data e horário.
- Endereço.
- Aviso.
- Rodapé.
- Assinatura institucional.

Os modelos devem priorizar legibilidade em dispositivos móveis. A redução do tamanho do texto deverá respeitar limites definidos pelo administrador.

O sistema não deverá resolver qualquer problema de conteúdo longo diminuindo indefinidamente a fonte.

---

## 8. Assistência textual por IA

A IA terá responsabilidade restrita ao conteúdo escrito.

### 8.1. Funcionalidades permitidas

- Correção ortográfica e gramatical.
- Revisão de pontuação.
- Melhoria de clareza e semântica.
- Ajustes de dicção e fluidez.
- Organização de informações.
- Sugestão de títulos e subtítulos.
- Resumos para espaços reduzidos.
- Distribuição sugerida de conteúdo entre páginas de carrossel.
- Identificação de repetições.
- Sugestões de adequação do texto ao tipo de comunicado.
- Sugestões de versões curtas e completas.

### 8.2. Restrições obrigatórias

A IA não deverá:

- Criar a arte final livremente.
- Alterar a identidade visual.
- Inventar cores ou elementos visuais durante a geração.
- Substituir automaticamente as imagens do modelo.
- Inventar datas, horários, endereços, valores, nomes ou informações oficiais.
- Excluir informações relevantes sem avisar o usuário.
- Publicar ou aprovar artes automaticamente.
- Alterar textos oficiais sem apresentar a revisão ao usuário.

### 8.3. Preservação de informações oficiais

Campos considerados factuais ou sensíveis para a comunicação institucional deverão ser preservados por padrão, incluindo:

- Datas.
- Horários.
- Endereços.
- Telefones e contatos.
- Nomes de pessoas e órgãos.
- Valores.
- Prazos.
- Números de leis, processos ou documentos.

Se a IA sugerir uma alteração nesses campos, deverá sinalizar a mudança e exigir conferência.

### 8.4. Fluxo de revisão

1. O usuário insere o texto original.
2. O sistema mantém o conteúdo original.
3. A IA retorna uma sugestão de revisão estruturada.
4. O sistema compara o original com a sugestão.
5. O usuário aceita, rejeita ou edita a sugestão.
6. Somente o texto confirmado segue para a composição.

A ausência de um provedor de IA não poderá impedir a utilização do editor ou a geração das artes.

---

## 9. Motor determinístico de composição e renderização

O motor de composição deverá transformar um template e seus dados em uma arte final reproduzível.

### 9.1. Entrada da composição

A composição deverá receber:

- Identificador e versão do modelo.
- Formato de saída.
- Dados textuais confirmados.
- Referências aos ativos utilizados.
- Paleta selecionada.
- Configurações tipográficas.
- Variantes de layout.
- Configurações de renderização.

### 9.2. Regras de posicionamento

O motor deverá interpretar a configuração do template para determinar:

- Posição e dimensão de cada elemento.
- Ordem das camadas.
- Margens e áreas seguras.
- Alinhamento.
- Cores e estilos.
- Preenchimento dos campos.
- Ajuste de texto dentro das áreas permitidas.
- Recorte de imagens.
- Visibilidade de elementos condicionais.
- Aplicação de variantes para cada formato.

O mesmo conjunto de dados, versão do template e versões dos ativos deverá produzir uma composição visual equivalente.

### 9.3. Ajuste de texto

A adaptação textual deverá seguir esta ordem:

1. Aplicar quebra de linha.
2. Ajustar o texto ao espaço disponível.
3. Utilizar os limites de tamanho definidos no modelo.
4. Sinalizar excesso de conteúdo.
5. Sugerir revisão textual ou outro modelo, quando necessário.

Não remover informações automaticamente nem reduzir a fonte abaixo do mínimo permitido.

### 9.4. Tecnologia de renderização

A implementação deverá avaliar a tecnologia mais adequada para a stack já existente do COMUNICA.

Considerar uma composição baseada em SVG, HTML/CSS ou outra tecnologia compatível com o projeto, seguida de renderização para PNG.

A decisão técnica deverá levar em conta:

- Compatibilidade com a infraestrutura existente.
- Precisão de posicionamento.
- Renderização de fontes.
- Recorte de imagens.
- Desempenho.
- Consumo de memória.
- Exportação em alta resolução.
- Suporte a múltiplos formatos.
- Facilidade de testes automatizados.

Não introduzir uma dependência pesada sem justificar a necessidade.

### 9.5. Reprodutibilidade

O sistema deverá registrar a versão do modelo, os ativos e os parâmetros utilizados na geração.

Uma arte já aprovada deverá continuar consultável mesmo que o modelo original seja atualizado posteriormente.

---

## 10. Validador automático de artes

Antes da aprovação final, o sistema deverá executar verificações técnicas e visuais.

### 10.1. Validações obrigatórias

- Dimensões finais corretas.
- Proporção correta.
- Existência dos campos obrigatórios.
- Textos dentro das áreas permitidas.
- Ausência de cortes de conteúdo.
- Ausência de sobreposições indevidas.
- Respeito às margens e áreas seguras.
- Tamanho mínimo de fonte respeitado.
- Contraste mínimo configurado.
- Imagens disponíveis e carregadas corretamente.
- Ausência de referências quebradas a ativos.
- Compatibilidade entre modelo e formato.
- Existência das versões obrigatórias de uma geração múltipla.
- Coerência entre páginas de um carrossel.

### 10.2. Classificação dos problemas

**Bloqueadores:** impedem a aprovação até serem resolvidos.

Exemplos: imagem ausente, texto obrigatório cortado, dimensão incorreta ou campo obrigatório vazio.

**Avisos:** permitem continuar após a conferência do usuário.

Exemplos: texto próximo do limite de linhas, imagem com resolução inferior à recomendada ou equilíbrio visual que merece revisão manual.

O sistema deverá informar o problema e, quando possível, apontar o elemento afetado.

A validação automatizada não substitui a conferência humana do resultado visual.

---

## 11. Modelo de dados e versionamento

Antes de criar novas tabelas, o agente deverá analisar o banco de dados e as entidades existentes no COMUNICA, reutilizando estruturas compatíveis.

A estrutura conceitual deverá contemplar as seguintes entidades, adaptadas à arquitetura real do projeto.

### 11.1. Templates

Armazenar:

- Identificador.
- Município ou escopo institucional.
- Nome e descrição.
- Categoria.
- Estado.
- Versão.
- Configuração estrutural do layout.
- Paleta associada.
- Estilos tipográficos.
- Formatos suportados.
- Campos dinâmicos.
- Regras de validação.
- Autor.
- Datas de criação e atualização.

### 11.2. Variantes de templates

Representar as diferentes composições de um mesmo modelo, como:

- 9:16.
- 3:4.
- Capa de carrossel.
- Página interna de carrossel.
- Página final de carrossel.

Cada variante poderá definir dimensões, posições, estilos, regras e elementos específicos.

### 11.3. Ativos visuais

Armazenar metadados e referências para imagens, ícones, fundos, fontes autorizadas e outros recursos gráficos.

### 11.4. Paletas e estilos

Manter paletas de cores, estilos tipográficos e regras de identidade visual reutilizáveis.

### 11.5. Gerações de arte

Registrar:

- Solicitação de origem, quando houver.
- Modelo e versão utilizados.
- Dados textuais confirmados.
- Formato ou formatos solicitados.
- Referências aos ativos utilizados.
- Resultado das validações.
- Estado da geração.
- Usuário responsável.
- Datas relevantes.
- Referência aos arquivos gerados.

### 11.6. Versionamento e histórico

- Modelos publicados deverão ter versões identificáveis.
- A edição de um modelo publicado deverá criar uma nova versão ou seguir o mecanismo de versionamento adotado no projeto.
- Artes históricas não deverão ser alteradas quando um modelo for atualizado.
- Alterações relevantes deverão ser auditáveis.
- O sistema deverá distinguir rascunho, geração, revisão, aprovação e arquivamento, conforme o fluxo já existente.

---

## 12. Integração com Solicitações e Biblioteca de Artes

A funcionalidade deverá aproveitar o fluxo atual do COMUNICA.

### 12.1. Integração com Solicitações

Quando a geração for iniciada a partir de uma solicitação, o sistema deverá:

- Recuperar os dados já cadastrados.
- Sugerir modelos compatíveis com o tipo de demanda.
- Permitir o complemento dos campos faltantes.
- Manter o vínculo com a solicitação de origem.
- Registrar o responsável pela produção.
- Permitir acompanhar o estado da arte.
- Evitar duplicar informações já disponíveis.

A seleção automática de um modelo poderá ser sugerida pelo sistema, mas o operador deverá poder escolher outra opção compatível.

### 12.2. Integração com a Biblioteca de Artes

Após a geração e conforme as permissões e o fluxo de aprovação existentes, o sistema deverá:

- Salvar os arquivos finais.
- Registrar a prévia.
- Manter os metadados da arte.
- Registrar o modelo e sua versão.
- Registrar o formato.
- Manter o vínculo com a solicitação de origem.
- Permitir pesquisa e filtragem.
- Preservar versões anteriores.
- Diferenciar materiais em produção e materiais aprovados.

A implementação deverá utilizar a Biblioteca de Artes existente sempre que possível, evitando a criação de um repositório paralelo.

---

## 13. Isolamento por município e permissões

O COMUNICA deverá respeitar integralmente a arquitetura multi-tenant já existente.

- Cada município deverá acessar apenas os templates, ativos e artes autorizados para seu escopo.
- Recursos globais só poderão ser compartilhados quando essa possibilidade existir na arquitetura e houver autorização explícita.
- O sistema deverá validar permissões no backend.
- Não confiar em identificadores ou permissões enviados pelo frontend.
- Todas as operações deverão validar o município e o escopo do recurso.
- Usuários sem permissão administrativa não poderão publicar, arquivar ou modificar modelos protegidos.
- Arquivos privados deverão utilizar as regras de acesso existentes.
- As rotas e consultas deverão impedir acesso cruzado entre municípios.

O agente deverá identificar o mecanismo atual de isolamento antes de implementar novas entidades ou endpoints.

---

## 14. Experiência de utilização

A interface deverá ser profissional, clara e adequada à rotina de uma equipe de comunicação.

### 14.1. Tela inicial do gerador

Apresentar:

- Botão para iniciar nova arte.
- Acesso às solicitações pendentes.
- Modelos disponíveis.
- Categorias de modelos.
- Artes recentes.
- Atalhos para a Biblioteca de Artes.
- Acesso administrativo aos modelos, conforme permissão.

### 14.2. Seleção de modelo

Cada modelo deverá apresentar:

- Miniatura.
- Nome.
- Descrição.
- Categoria.
- Formatos disponíveis.
- Indicação de compatibilidade com carrossel.
- Situação de publicação.

A seleção deverá ser visual, permitindo comparar opções sem abrir cada modelo individualmente.

### 14.3. Tela de produção

A tela deverá separar claramente:

- Campos de conteúdo.
- Assistência textual.
- Prévia da arte.
- Seleção de formato.
- Avisos de validação.
- Ações de salvar, revisar, gerar novamente e aprovar.

A prévia deverá refletir as alterações confirmadas sem exigir uma nova geração textual por IA.

### 14.4. Diretrizes visuais da interface

- Priorizar simplicidade e velocidade.
- Evitar excesso de ícones decorativos.
- Evitar gradientes, brilhos e ornamentos sem função.
- Utilizar hierarquia tipográfica clara.
- Manter alinhamentos consistentes.
- Oferecer estados de carregamento e mensagens de erro objetivos.
- Tornar os avisos visuais perceptíveis sem poluir a interface.
- Garantir usabilidade em telas menores quando compatível com o restante do sistema.

---

## 15. Segurança e tratamento de arquivos

- Validar o tipo e o tamanho dos arquivos enviados.
- Validar imagens antes de utilizá-las na renderização.
- Evitar confiar exclusivamente na extensão do arquivo.
- Restringir formatos de ativos a uma lista permitida.
- Aplicar as políticas de autenticação e autorização existentes.
- Impedir acesso direto não autorizado aos arquivos privados.
- Evitar injeção de HTML, CSS ou SVG por meio de conteúdo não confiável.
- Sanitizar os dados inseridos nos campos.
- Não executar conteúdo arbitrário fornecido por templates.
- Restringir o acesso a fontes e recursos locais.
- Registrar falhas de renderização sem expor dados sensíveis.
- Evitar registrar chaves de API ou conteúdo sensível desnecessário nos logs.

Se houver uso de provedor externo de IA, respeitar as políticas de configuração, tratamento de dados e armazenamento já adotadas pelo projeto.

---

## 16. Endpoints e serviços

O agente deverá seguir os padrões de rotas, serviços, controladores e validação já utilizados pelo COMUNICA.

Os grupos conceituais abaixo indicam as capacidades necessárias, não uma exigência de criar exatamente essas rotas.

### 16.1. Modelos

- Listar modelos disponíveis.
- Consultar detalhes de um modelo.
- Criar um modelo.
- Editar um rascunho.
- Duplicar um modelo.
- Testar um modelo.
- Publicar uma versão.
- Arquivar um modelo.
- Consultar o histórico de versões.

### 16.2. Biblioteca de ativos

- Listar ativos.
- Pesquisar por categoria e tags.
- Enviar um ativo.
- Consultar metadados.
- Atualizar metadados.
- Arquivar um ativo.
- Verificar se um ativo está sendo utilizado.

### 16.3. Paletas e estilos

- Listar paletas.
- Criar e editar paletas.
- Validar valores de cores.
- Gerenciar estilos tipográficos.
- Definir regras de aplicação.

### 16.4. Geração

- Solicitar geração.
- Consultar o estado de processamento.
- Obter a prévia.
- Consultar os resultados de validação.
- Regenerar após alterações.
- Aprovar ou rejeitar conforme as permissões.
- Exportar os formatos gerados.
- Registrar a geração na Biblioteca de Artes.

### 16.5. Assistência textual

- Solicitar revisão de texto.
- Solicitar resumo.
- Solicitar sugestões de títulos.
- Solicitar estruturação para carrossel.
- Retornar o texto original e a versão sugerida.
- Permitir revisão manual antes de confirmar o conteúdo.

As operações de geração e exportação deverão tratar falhas e evitar duplicações acidentais. Se o processamento for assíncrono, deverá seguir o mecanismo de filas ou processamento já adotado pelo projeto, sem introduzir infraestrutura desnecessária.

---

## 17. Critérios de aceite

A implementação será considerada funcionalmente aceita quando:

1. Um administrador puder criar e configurar um modelo visual.
2. O modelo puder utilizar elementos da biblioteca.
3. Paletas e estilos tipográficos puderem ser reutilizados.
4. Os elementos puderem ser classificados como fixos, editáveis, dinâmicos, opcionais ou condicionais.
5. O modelo puder ser testado antes da publicação.
6. Um operador puder escolher um modelo publicado e preencher seu conteúdo.
7. A assistência por IA puder revisar o texto sem modificar a arte livremente.
8. O usuário puder rejeitar a sugestão da IA e manter o texto original.
9. A arte puder ser gerada sem utilização de IA.
10. A opção 9:16 produzir uma imagem de 1080 × 1920 px.
11. A opção combinada produzir versões de 1080 × 1920 px e 1080 × 1440 px.
12. A opção de carrossel produzir múltiplas páginas de 1080 × 1440 px.
13. Cada formato utilizar uma composição compatível, sem simples redimensionamento indiscriminado.
14. O validador identificar problemas de conteúdo e composição.
15. O sistema impedir aprovação quando houver erros bloqueadores.
16. A geração puder ser pré-visualizada antes da aprovação.
17. Os materiais aprovados forem armazenados na Biblioteca de Artes existente.
18. A relação com a solicitação de origem for preservada.
19. As versões dos modelos e ativos utilizados forem rastreáveis.
20. O isolamento entre municípios for respeitado.
21. As permissões forem validadas no backend.
22. A implementação possuir testes automatizados para os fluxos principais.
23. A falha de um serviço de IA não impedir a geração manual.
24. A atualização de um modelo não alterar artes históricas já geradas.

---

## 18. Plano de testes

### 18.1. Testes unitários

- Validação de paletas.
- Resolução de estilos tipográficos.
- Cálculo de dimensões.
- Quebra de linha.
- Ajuste de texto.
- Aplicação de regras condicionais.
- Seleção de variantes.
- Validação de campos obrigatórios.
- Verificação de compatibilidade entre formato e modelo.
- Tratamento de falhas de renderização.

### 18.2. Testes de integração

- Criação e publicação de modelos.
- Carregamento de ativos.
- Geração nos três formatos.
- Revisão textual e confirmação manual.
- Persistência da geração.
- Integração com Solicitações.
- Integração com Biblioteca de Artes.
- Controle de permissões.
- Isolamento entre municípios.
- Recuperação de erros durante o processamento.

### 18.3. Testes visuais

Criar casos de referência para verificar:

- Texto curto.
- Texto longo.
- Título com muitas palavras.
- Data e horário extensos.
- Conteúdo com acentos e caracteres especiais.
- Ausência de imagem opcional.
- Imagem de proporção diferente da área de destino.
- Conteúdo próximo aos limites do template.
- Variações de 9:16 e 3:4.
- Carrosséis com quantidades diferentes de páginas.

Os testes visuais deverão verificar dimensões, cortes, sobreposições e consistência dos resultados.

### 18.4. Testes de segurança

- Acesso não autorizado a modelos.
- Acesso cruzado entre municípios.
- Upload de arquivos inválidos.
- Conteúdo malicioso em campos de texto.
- Referências inválidas a ativos.
- Tentativas de alterar elementos protegidos.
- Tentativas de aprovar ou publicar sem permissão.

---

## 19. Plano de implementação por fases

A funcionalidade deverá ser desenvolvida de maneira incremental, com entregas testáveis.

### Fase 1 — Análise e fundação

- Analisar a arquitetura atual do COMUNICA.
- Identificar entidades, rotas, permissões, armazenamento e padrões de interface existentes.
- Mapear Solicitações e Biblioteca de Artes.
- Definir o modelo de dados.
- Definir o formato de configuração dos templates.
- Implementar a biblioteca de ativos.
- Implementar paletas e estilos tipográficos.
- Implementar as regras fundamentais de composição.
- Definir a tecnologia de renderização.

**Entrega:** estrutura técnica preparada para armazenar recursos visuais e compor artes determinísticas.

### Fase 2 — Motor de composição e validação

- Implementar o carregamento de modelos.
- Implementar campos dinâmicos.
- Implementar posicionamento e camadas.
- Implementar quebra de linha e limites tipográficos.
- Implementar renderização PNG.
- Implementar as três modalidades de saída.
- Implementar validações e mensagens de erro.
- Criar testes automatizados de composição.

**Entrega:** geração funcional a partir de templates previamente configurados.

### Fase 3 — Editor administrativo de modelos

- Criar interface de edição visual.
- Implementar inserção e posicionamento de elementos.
- Implementar controle de camadas.
- Implementar bloqueio de elementos.
- Implementar campos dinâmicos.
- Implementar variantes de formato.
- Implementar prévia.
- Implementar rascunhos, publicação e versionamento.

**Entrega:** administradores autorizados conseguem criar e manter modelos sem alterar manualmente o código da aplicação.

### Fase 4 — Editor de produção

- Criar seleção visual de modelos.
- Criar formulário dinâmico conforme o template.
- Implementar substituição de imagens autorizadas.
- Implementar prévia da composição.
- Implementar correções manuais.
- Implementar geração, regeneração e validação.
- Implementar revisão e aprovação.

**Entrega:** operadores conseguem produzir artes utilizando modelos publicados.

### Fase 5 — Assistência textual por IA

- Integrar com a camada de IA já existente, se houver.
- Implementar revisão ortográfica e gramatical.
- Implementar melhoria de clareza e semântica.
- Implementar resumo e sugestão de títulos.
- Implementar estruturação de carrosséis.
- Implementar comparação entre texto original e sugerido.
- Preservar os campos factuais.
- Implementar fallback manual.

**Entrega:** assistência textual integrada, opcional e sujeita à aprovação do usuário.

### Fase 6 — Integração e finalização

- Integrar com Solicitações.
- Integrar com Biblioteca de Artes.
- Implementar rastreabilidade.
- Verificar isolamento por município.
- Finalizar testes automatizados.
- Testar os fluxos completos.
- Documentar as operações administrativas.
- Validar o comportamento em produção antes da liberação geral.

**Entrega:** funcionalidade integrada ao fluxo real do COMUNICA.

---

## 20. Fora do escopo inicial

Para evitar crescimento descontrolado da implementação, não incluir na primeira versão:

- Geração livre de imagens por IA durante a produção.
- Animações e edição de vídeo.
- Colaboração em tempo real entre vários editores.
- Marketplace público de templates.
- Editor avançado equivalente a todas as funções do Canva.
- Publicação automática em redes sociais, salvo se já existir infraestrutura específica no COMUNICA.
- Escolha irrestrita de fontes, cores e efeitos pelos operadores.
- Alterações visuais automáticas não rastreáveis.

Esses recursos poderão ser avaliados posteriormente com base nas necessidades reais.

---

## 21. Instruções finais para o agente de implementação

Antes de modificar o código:

1. Inspecionar a estrutura real do repositório COMUNICA.
2. Identificar a stack, os padrões arquiteturais e as dependências já utilizadas.
3. Localizar as funcionalidades de Solicitações e Biblioteca de Artes.
4. Identificar a estratégia atual de autenticação, autorização, isolamento por município e armazenamento de arquivos.
5. Elaborar um plano técnico de implementação compatível com a arquitetura existente.
6. Identificar os componentes e serviços que podem ser reutilizados.
7. Apontar riscos técnicos e decisões que dependem de confirmação.
8. Implementar a funcionalidade em fases pequenas, mantendo o sistema existente funcional.

Não presumir nomes de tabelas, arquivos, rotas ou serviços sem verificar o código real.

Não criar entidades, bibliotecas ou abstrações duplicadas quando já existir uma solução adequada no projeto.

Não substituir funcionalidades existentes sem avaliar suas dependências e seus fluxos de utilização.

Cada fase deverá incluir testes e uma descrição clara dos arquivos alterados, decisões técnicas e limitações remanescentes.

### Resultado esperado

O COMUNICA deverá passar a contar com um sistema profissional de criação de artes institucionais, no qual administradores montam modelos visuais reutilizáveis, operadores produzem materiais a partir desses modelos e o motor determinístico garante consistência na composição e na exportação.

A IA será uma ferramenta de apoio à escrita, não uma responsável pela criação visual livre. A biblioteca de elementos garantirá variedade; as paletas e regras tipográficas preservarão a identidade visual; o editor administrativo permitirá evoluir os modelos; e a integração com Solicitações e Biblioteca de Artes manterá o processo organizado e rastreável.

**Diretriz principal: liberdade criativa controlada na construção dos modelos, automação determinística na produção cotidiana e assistência por IA restrita ao conteúdo textual.**