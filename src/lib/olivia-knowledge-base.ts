export type OliviaTopico = {
  titulo: string;
  rota: string;
  rolesPermitidos: string[];
  resumo: string;
  comoUsar: string[];
};

const TODOS = ['super_admin', 'admin', 'secom', 'secretaria', 'imprensa'];
const STAFF_SEM_IMPRENSA = ['super_admin', 'admin', 'secom', 'secretaria'];
const COMUNICACAO = ['super_admin', 'admin', 'secom'];
const SO_ADMIN = ['super_admin', 'admin'];
const SO_SUPER_ADMIN = ['super_admin'];

export const OLIVIA_KNOWLEDGE_BASE: OliviaTopico[] = [
  {
    titulo: 'Painel Inicial (Dashboard)',
    rota: '/',
    rolesPermitidos: TODOS,
    resumo: 'Página inicial com a agenda da semana, contagem de solicitações pendentes/em produção, atividade recente e indicadores de desempenho.',
    comoUsar: [
      'É a primeira tela ao entrar no sistema.',
      'Mostra quantas solicitações estão pendentes e em produção.',
      'Traz um resumo dos eventos da semana, com atalho para o Calendário.',
      'Para secom/admin, também mostra o progresso das metas mensais de mídia.',
    ],
  },
  {
    titulo: 'Solicitações (Chamados)',
    rota: '/solicitacoes',
    rolesPermitidos: TODOS,
    resumo: 'É o fluxo principal do sistema: pedir uma peça de comunicação (post, vídeo, banner etc.) para a equipe produzir, e acompanhar até a entrega.',
    comoUsar: [
      'Clique em "Abrir Chamado" (botão azul no topo do menu) para criar uma nova solicitação.',
      'Preencha título e descrição/briefing — quanto mais detalhes, melhor; dá para usar a IA para ajudar a estruturar o texto.',
      'Acompanhe o status do chamado: pendente → aprovado → produção → concluído → finalizado (ou cancelado).',
      'Quem tem permissão (admin/secom/super_admin) pode mudar o status e conversar pelos comentários do chamado.',
      'Um chamado cancelado pode ser excluído em definitivo por admin/secom/super_admin.',
    ],
  },
  {
    titulo: 'Calendário Institucional',
    rota: '/eventos',
    rolesPermitidos: TODOS,
    resumo: 'Agenda de eventos e ações de todas as secretarias, com visão em lista, kanban por status ou calendário mensal.',
    comoUsar: [
      'Clique em "Agendar Evento" para cadastrar um novo evento (título, data, local, responsáveis).',
      'Alterne entre Lista, Kanban e Calendário no topo da página.',
      'Um evento pode aceitar inscrições públicas — nesse caso ele aparece também na Agenda de Imprensa.',
    ],
  },
  {
    titulo: 'Planejamento',
    rota: '/planejamento',
    rolesPermitidos: TODOS,
    resumo: 'Espaço para montar planos de ação estratégicos, com tarefas (ações) e indicadores (metas) acompanhados ao longo do tempo.',
    comoUsar: [
      'Crie um "Plano de Ação" com um objetivo geral.',
      'Dentro do plano, cadastre ações com prazo e status — cada ação pode estar ligada a um evento do Calendário.',
      'Cadastre indicadores (KPIs) e registre valores ao longo do tempo para medir o progresso.',
      'É possível exportar/imprimir um plano em PDF.',
    ],
  },
  {
    titulo: 'Inscrições',
    rota: '/inscricoes',
    rolesPermitidos: STAFF_SEM_IMPRENSA,
    resumo: 'Painel central para gerenciar inscrições públicas em eventos que aceitam cadastro (workshops, capacitações, campanhas).',
    comoUsar: [
      'Mostra todos os eventos com inscrições abertas e quantas pessoas já se inscreveram.',
      'Abra um evento para configurar o formulário de inscrição, ver a lista de inscritos, aprovar ou remover duplicados.',
      'Dá para exportar a lista de inscritos em CSV.',
    ],
  },
  {
    titulo: 'Releases (Notas de Imprensa)',
    rota: '/releases',
    rolesPermitidos: COMUNICACAO,
    resumo: 'Redação e publicação de releases (notas de imprensa) vinculados a uma secretaria, com imagem de capa.',
    comoUsar: [
      'Crie um release com título, texto, secretaria responsável e imagem de capa.',
      'Publique quando estiver pronto — releases publicados aparecem na Agenda de Imprensa pública.',
    ],
  },
  {
    titulo: 'Biblioteca de Materiais',
    rota: '/biblioteca',
    rolesPermitidos: TODOS,
    resumo: 'Acervo de materiais finalizados (artes, vídeos, posts já entregues), para consultar e reaproveitar peças antigas.',
    comoUsar: [
      'Busque por secretaria, tipo de mídia ou mês.',
      'Só aparecem solicitações já concluídas/finalizadas com arte final anexada.',
    ],
  },
  {
    titulo: 'Relatórios',
    rota: '/relatorios',
    rolesPermitidos: COMUNICACAO,
    resumo: 'Painel de indicadores (KPIs) da equipe de comunicação: total de solicitações, taxa de conclusão, tempo médio de entrega, releases publicados.',
    comoUsar: [
      'Filtre por período e por secretaria.',
      'Dá para gerar um relatório em PDF para apresentação.',
    ],
  },
  {
    titulo: 'Formulários de Inscrição',
    rota: '/formularios',
    rolesPermitidos: COMUNICACAO,
    resumo: 'Modelos reutilizáveis de formulário (campos personalizados) para anexar à inscrição pública de um evento.',
    comoUsar: [
      'Crie um modelo com os campos que quiser coletar do inscrito.',
      'Na hora de configurar as inscrições de um evento, escolha esse modelo.',
    ],
  },
  {
    titulo: 'Agenda de Imprensa',
    rota: '/imprensa/agenda',
    rolesPermitidos: TODOS,
    resumo: 'Página pública (fora do login) com os próximos eventos publicados e releases recentes, para a imprensa e o público em geral.',
    comoUsar: [
      'É a vitrine externa — não precisa estar logado para ver.',
      'Só mostra eventos e releases já publicados.',
    ],
  },
  {
    titulo: 'Chat interno',
    rota: '/solicitacoes',
    rolesPermitidos: TODOS,
    resumo: 'Chat em tempo real entre usuários do sistema, com criptografia de ponta a ponta, para conversas diretas ou em grupo.',
    comoUsar: [
      'Abra pelo botão flutuante "Chat" (desktop) ou pela aba "Chat" do menu inferior (celular).',
      'Dá para enviar texto, imagem e áudio, ver quem está digitando e quem já leu.',
    ],
  },
  {
    titulo: 'Municípios',
    rota: '/admin/municipios',
    rolesPermitidos: SO_SUPER_ADMIN,
    resumo: 'Gerenciamento dos municípios atendidos pela plataforma — cada um é isolado, com suas próprias secretarias, usuários e dados.',
    comoUsar: [
      'Só o super_admin vê esta página.',
      'É possível trocar o "município ativo" pelo seletor no topo da tela para ver os dados de um município específico.',
    ],
  },
  {
    titulo: 'WhatsApp',
    rota: '/admin/whatsapp',
    rolesPermitidos: SO_SUPER_ADMIN,
    resumo: 'Conecta o número de WhatsApp da prefeitura para enviar notificações automáticas sobre chamados aos usuários que aceitarem.',
    comoUsar: [
      'Conecte escaneando o QR code exibido na tela.',
      'Depois de conectado, os usuários podem ativar as notificações pelo próprio WhatsApp.',
    ],
  },
  {
    titulo: 'Secretarias',
    rota: '/admin/secretarias',
    rolesPermitidos: SO_ADMIN,
    resumo: 'Cadastro das secretarias do município, cada uma com nome, cor de identificação e status ativo/inativo.',
    comoUsar: [
      'Toda solicitação e evento fica vinculado a uma secretaria.',
      'A cor escolhida aqui aparece nas etiquetas em todo o sistema.',
    ],
  },
  {
    titulo: 'Usuários',
    rota: '/admin/usuarios',
    rolesPermitidos: SO_ADMIN,
    resumo: 'Cadastro e gerenciamento de contas de usuário: papel (role), secretaria vinculada e status ativo.',
    comoUsar: [
      'Crie um usuário informando e-mail, secretaria e papel de acesso.',
      'Você pode desativar um usuário sem excluir o histórico dele.',
    ],
  },
  {
    titulo: 'Configurações',
    rota: '/admin/configuracoes',
    rolesPermitidos: SO_ADMIN,
    resumo: 'Ajustes gerais do sistema: nome/identidade visual do site e metas mensais de produção de mídia.',
    comoUsar: [
      'As metas cadastradas aqui alimentam o indicador de progresso mensal no painel inicial.',
    ],
  },
  {
    titulo: 'Assistente IA (configurações)',
    rota: '/ia/perfil',
    rolesPermitidos: SO_ADMIN,
    resumo: 'Tela de configuração do comportamento e do modelo de IA usados pelas ferramentas de apoio à escrita (sugestão de descrição, correção de texto etc.).',
    comoUsar: [
      'Não é o mesmo chat que a Olivia — aqui se ajusta o "tom" da IA usada dentro dos formulários de solicitação e eventos.',
    ],
  },
  {
    titulo: 'Armazenamento',
    rota: '/admin/armazenamento',
    rolesPermitidos: SO_ADMIN,
    resumo: 'Mostra o espaço em disco usado pelos arquivos enviados ao sistema (artes de solicitações, avatares, capas de eventos) e permite apagar arquivos avulsos.',
    comoUsar: [
      'Útil quando o espaço de armazenamento do servidor está ficando cheio.',
    ],
  },
  {
    titulo: 'Recuperar senha / primeiro acesso',
    rota: '/login',
    rolesPermitidos: TODOS,
    resumo: 'Se o usuário esqueceu a senha ou não tem acesso, o cadastro de conta é feito por um admin — não existe autocadastro.',
    comoUsar: [
      'Peça para um admin ou super_admin do seu município criar/redefinir seu acesso em "Usuários".',
    ],
  },
];

const STOPWORDS = new Set([
  'como', 'para', 'que', 'uma', 'um', 'de', 'da', 'do', 'no', 'na', 'os', 'as',
  'com', 'por', 'onde', 'qual', 'quais', 'isso', 'esse', 'essa', 'tem', 'faço',
  'eu', 'voce', 'você', 'pode', 'ser', 'sao', 'são', 'meu', 'minha', 'ao', 'em',
]);

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function palavrasRelevantes(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !STOPWORDS.has(p));
}

/**
 * Filtra os tópicos pelo texto da pergunta atual, para não mandar a base de
 * conhecimento inteira como contexto em toda mensagem (deixa o prompt mais
 * enxuto e a resposta do modelo local mais rápida). Título pesa mais que
 * resumo/como-usar, pra um tópico só "citado de passagem" não furar na
 * frente do tópico que é realmente sobre o assunto perguntado. Sem match
 * nenhum, cai para os primeiros `limite` tópicos (os mais centrais do
 * sistema) em vez de mandar tudo — mantém o contexto leve mesmo em
 * perguntas genéricas.
 */
export function selecionarTopicosRelevantes(
  topicos: OliviaTopico[],
  mensagem: string,
  limite = 6
): OliviaTopico[] {
  const palavras = palavrasRelevantes(mensagem);
  if (palavras.length === 0) return topicos.slice(0, limite);

  const pontuados = topicos
    .map((t) => {
      const titulo = normalizar(t.titulo);
      const corpo = normalizar(`${t.resumo} ${t.comoUsar.join(' ')}`);
      const pontos = palavras.reduce((acc, p) => {
        if (titulo.includes(p)) return acc + 3;
        if (corpo.includes(p)) return acc + 1;
        return acc;
      }, 0);
      return { topico: t, pontos };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);

  if (pontuados.length === 0) return topicos.slice(0, limite);
  return pontuados.slice(0, limite).map((x) => x.topico);
}
