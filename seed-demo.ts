/**
 * Seed de demonstração — popula o banco com dados realistas para testar
 * paginação e interface com volume.
 *
 * Uso: npx tsx seed-demo.ts
 * Para limpar e re-seed: npx tsx seed-demo.ts --reset
 */

import sequelize from './src/config/database.ts';
import {
  User,
  Secretaria,
  Evento,
  Solicitacao,
  Release,
  SolicitacaoComentario,
} from './src/database/models/index.ts';
import bcrypt from 'bcryptjs';

const RESET = process.argv.includes('--reset');

// ─── helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setMinutes(0, 0, 0);
  return d;
}

function randomHour(date: Date, h: number): Date {
  const d = new Date(date);
  d.setHours(h, 0, 0, 0);
  return d;
}

// ─── dados base ─────────────────────────────────────────────────────────────

const SECRETARIAS = [
  { nome: 'Comunicação (SECOM)',         slug: 'secom',        cor: '#ef4444' },
  { nome: 'Saúde',                        slug: 'saude',        cor: '#10b981' },
  { nome: 'Educação',                     slug: 'educacao',     cor: '#3b82f6' },
  { nome: 'Infraestrutura e Obras',       slug: 'infra',        cor: '#f59e0b' },
  { nome: 'Assistência Social',           slug: 'social',       cor: '#8b5cf6' },
  { nome: 'Finanças e Orçamento',         slug: 'financas',     cor: '#64748b' },
  { nome: 'Cultura e Turismo',            slug: 'cultura',      cor: '#ec4899' },
  { nome: 'Meio Ambiente',                slug: 'meio-ambiente', cor: '#22c55e' },
  { nome: 'Esportes e Lazer',             slug: 'esportes',     cor: '#06b6d4' },
];

const NOMES = [
  'Ana Paula Ferreira', 'Carlos Eduardo Souza', 'Mariana Lima Santos',
  'Roberto Alves Costa', 'Fernanda Oliveira', 'João Pedro Nascimento',
  'Juliana Mendes', 'Anderson Silva', 'Patrícia Rocha', 'Thiago Martins',
  'Larissa Campos', 'Bruno Henrique Dias', 'Camila Torres', 'Rafael Gomes',
  'Débora Carvalho', 'Lucas Andrade', 'Vanessa Freitas', 'Marcos Vinícius',
  'Aline Correia', 'Felipe Barbosa',
];

const TIPOS_EVENTO = [
  'Coletiva de imprensa', 'Inauguração', 'Reunião', 'Conferência',
  'Palestra', 'Seminário', 'Lançamento', 'Visita técnica', 'Audiência pública',
  'Entrega de obras', 'Cerimônia', 'Workshop',
];

const STATUS_EVENTOS = [
  'em_planejamento', 'em_producao', 'em_analise',
  'concluido', 'publicado', 'cancelado',
];

const LOCAIS = [
  'Câmara Municipal', 'Paço Municipal', 'Auditório da Prefeitura',
  'Centro Cultural Municipal', 'Ginásio Poliesportivo', 'Praça Central',
  'UBS Central', 'CRAS Norte', 'Escola Municipal João XXIII',
  'Parque Ecológico', 'Estádio Municipal', 'Sede da SECOM',
  'Salão Nobre da Prefeitura', 'Plenário da Câmara',
];

const TITULOS_EVENTOS = [
  'Inauguração da UPA 24h do Distrito Norte',
  'Coletiva sobre obras do Anel Viário',
  'Conferência Municipal de Saúde',
  'Entrega de 120 cestas básicas às famílias vulneráveis',
  'Lançamento do Programa Jovem Aprendiz Municipal',
  'Audiência Pública — Orçamento Participativo 2026',
  'Palestra: Cuidados com a Dengue na Chuva',
  'Inauguração do Parque Linear do Rio Verde',
  'Reunião do Comitê de Desenvolvimento Econômico',
  'Seminário de Educação Ambiental nas Escolas',
  'Entrega das Chaves — Habitação Popular Fase III',
  'Workshop de Capacitação para Servidores',
  'Cerimônia de Posse da Nova Mesa Diretora',
  'Coletiva: Resultados do IDEB Municipal',
  'Lançamento do Aplicativo de Serviços ao Cidadão',
  'Visita Técnica ao Aterro Sanitário Renovado',
  'Apresentação do Plano Diretor Revisado',
  'Festa Junina da Cultura Popular',
  'Abertura da Semana do Meio Ambiente',
  'Campanha de Vacinação nas Escolas',
  'Inauguração da Quadra Poliesportiva do Bairro Novo',
  'Entrega de Equipamentos para a Defesa Civil',
  'Palestra sobre Empreendedorismo Feminino',
  'Reunião Ordinária do Conselho Municipal de Saúde',
  'Abertura do Torneio Esportivo Escolar',
  'Lançamento do Calendário Cultural 2026',
  'Coletiva: Novo convênio com Governo Estadual',
  'Entrega de Títulos de Regularização Fundiária',
  'Cerimônia de Formatura — CRAS e CREAS',
  'Inauguração da Biblioteca Pública Central',
  'Visita de Vereadores à Obra da Ponte Nova',
  'Conferência de Turismo Regional',
  'Palestra: Prevenção ao Bullying nas Escolas',
  'Workshop de Inclusão Digital para Idosos',
  'Lançamento do Programa Mais Verde',
  'Audiência Pública — Concessão de Transporte',
  'Entrega de Uniformes Escolares',
  'Cerimônia de Hasteamento — Dia da Bandeira',
  'Seminário de Gestão Pública Municipal',
  'Inauguração do Centro de Triagem de Resíduos',
];

const TITULOS_RELEASES = [
  'Prefeitura investe R$ 2,3 milhões em pavimentação',
  'Nova UPA atenderá mais de 80 mil moradores',
  'Programa de bolsas beneficia 450 estudantes',
  'Mutirão de saúde realiza 1.200 atendimentos gratuitos',
  'Obras do Anel Viário chegam a 60% de conclusão',
  'Município recebe prêmio de gestão eficiente',
  'Secretaria de Saúde lança campanha de vacinação',
  'Escola recebe reforma completa de R$ 800 mil',
  'Prefeitura firma convênio para creches públicas',
  'Novo parque ecológico abre as portas neste sábado',
  'Programa habitacional entrega mais 80 moradias',
  'Chuvas: equipes da Defesa Civil em alerta máximo',
  'Carnaval 2026 terá programação inédita na cidade',
  'Feira do empreendedor reúne 200 expositores',
  'Secretaria de Educação anuncia calendário letivo 2026',
  'Investimento em energia solar reduz custos da prefeitura em 35%',
  'Mapeamento identifica 3 mil famílias em situação de vulnerabilidade',
  'Prefeitura zera fila de espera em cirurgias eletivas',
  'Novo aplicativo facilita acesso a serviços municipais',
  'Cidade é destaque em ranking de saneamento básico',
  'Obras da nova Escola Técnica iniciam em março',
  'Plantio de 5 mil árvores marca Semana do Meio Ambiente',
  'Prefeitura lança edital para concessão de quiosques na orla',
  'Programa Bolsa Estudo beneficia famílias de baixa renda',
  'Revitalização da praça central é concluída com sucesso',
];

const TIPOS_MIDIA = [
  'Fotografia', 'Vídeo', 'Cobertura jornalística',
  'Nota à imprensa', 'Release', 'Arte gráfica', 'Transmissão ao vivo',
];

const STATUS_SOLIC = ['pendente', 'em_andamento', 'concluido', 'cancelado'];

const TITULOS_SOLIC = [
  'Cobertura fotográfica da inauguração do novo CRAS',
  'Produção de vídeo institucional da Secretaria de Saúde',
  'Nota de esclarecimento sobre obras na Rua das Flores',
  'Arte para campanha de vacinação infantil',
  'Transmissão ao vivo da audiência pública',
  'Release sobre entrega de habitações populares',
  'Cobertura da formatura dos alunos do CRAS',
  'Fotografia para material de divulgação da Secretaria',
  'Vídeo de abertura do Torneio Escolar',
  'Arte para faixa de inauguração do parque',
  'Nota sobre suspensão do fornecimento de água',
  'Release do novo convênio com o Estado',
  'Cobertura da reunião do Conselho Municipal',
  'Fotografia do mutirão de limpeza urbana',
  'Vídeo tutorial sobre app municipal',
  'Arte para carnaval 2026',
  'Cobertura da entrega de kits escolares',
  'Nota sobre licitação de transporte público',
  'Fotografia da inauguração da quadra esportiva',
  'Release do investimento em energia solar',
  'Arte para campanha do agasalho',
  'Cobertura do seminário de educação ambiental',
  'Vídeo depoimento de beneficiados do programa habitacional',
  'Nota sobre incidente na obra do viaduto',
  'Fotografia do prefeito na visita técnica',
  'Arte para Dia das Mães — anúncio de programação',
  'Cobertura fotográfica do evento cultural',
  'Release sobre prêmio de gestão municipal',
  'Vídeo institucional para redes sociais',
  'Arte para aniversário da cidade',
];

const COMENTARIOS = [
  'Arquivo recebido e encaminhado para o fotógrafo responsável.',
  'Material em edição, entrega prevista para amanhã.',
  'Imagens já capturadas, aguardando aprovação do cliente.',
  'Aguardando confirmação do local e horário.',
  'Equipe alocada, seguindo conforme planejado.',
  'Revisão solicitada: ajustar o texto do call-to-action.',
  'Arte finalizada e enviada para aprovação.',
  'Cobertura concluída com sucesso. Materiais em edição.',
  'Previsão de entrega antecipada para amanhã às 14h.',
  'Necessário reagendar: evento transferido para próxima semana.',
  'Material aprovado! Pode publicar.',
  'Solicitei à equipe de TI o link para transmissão.',
  'Fotos enviadas para o WhatsApp do responsável.',
  'Aguardando assinatura do contrato de uso de imagem.',
  'Vídeo em fase de corte final, legenda em produção.',
];

// ─── main ────────────────────────────────────────────────────────────────────

async function addCol(table: string, column: string, definition: string) {
  try {
    await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (e: any) {
    if (!e.message?.includes('duplicate column name')) throw e;
  }
}

async function main() {
  await sequelize.authenticate();
  await sequelize.sync({ force: false });

  // Garante colunas adicionadas recentemente
  await addCol('users', 'avatar', 'VARCHAR(255) NULL');
  await addCol('users', 'celular', 'VARCHAR(50) NULL');
  await addCol('releases', 'imagem_capa', 'VARCHAR(255) NULL');
  await addCol('releases', 'agendado_para', 'DATETIME NULL');
  await addCol('releases', 'secretaria_id', 'INTEGER NULL');
  await addCol('configuracoes', 'status_eventos', 'TEXT NULL');

  if (RESET) {
    console.log('⚠️  Limpando dados de demo...');
    await SolicitacaoComentario.destroy({ where: {}, truncate: true });
    await Solicitacao.destroy({ where: {}, truncate: true });
    await Evento.destroy({ where: {}, truncate: true });
    await Release.destroy({ where: {}, truncate: true });
    // remove usuários que não sejam o admin original
    await User.destroy({ where: { role: ['secom', 'secretaria', 'imprensa'] }, truncate: false });
    // remove secretarias extras
    const secom = await Secretaria.findOne({ where: { slug: 'secom' } });
    if (secom) {
      const { Op } = await import('sequelize');
      await Secretaria.destroy({ where: { id: { [Op.ne]: secom.id } } });
    }
    console.log('✅  Dados limpos.\n');
  }

  // ── 1. Secretarias ──────────────────────────────────────────────────────
  console.log('📁  Criando secretarias...');
  const secretariasMap: Record<string, Secretaria> = {};

  for (const s of SECRETARIAS) {
    const [sec] = await Secretaria.findOrCreate({
      where: { slug: s.slug },
      defaults: { nome: s.nome, cor: s.cor, ativo: true },
    });
    secretariasMap[s.slug] = sec;
  }
  const allSecs = Object.values(secretariasMap);
  console.log(`   ${allSecs.length} secretarias OK.`);

  // ── 2. Usuários ─────────────────────────────────────────────────────────
  console.log('👥  Criando usuários...');
  const senhaHash = await bcrypt.hash('demo123', 10);
  const roles: Array<'secom' | 'secretaria' | 'imprensa'> = ['secom', 'secretaria', 'imprensa'];
  const usersCreated: User[] = [];

  // garante que o admin existe
  const adminUser = await User.findOne({ where: { role: 'admin' } });

  for (let i = 0; i < NOMES.length; i++) {
    const nome = NOMES[i];
    const slug = nome.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const email = `${slug}@prefeitura.demo.br`;
    const role = i < 6 ? 'secom' : i < 14 ? 'secretaria' : 'imprensa';
    const sec = i < 6 ? secretariasMap['secom'] : pick(allSecs.filter(s => s.slug !== 'secom'));

    const [u] = await User.findOrCreate({
      where: { email },
      defaults: {
        nome,
        email,
        senha_hash: senhaHash,
        role,
        ativo: true,
        secretaria_id: sec.id,
      },
    });
    usersCreated.push(u);
  }

  const allUsers = adminUser ? [adminUser, ...usersCreated] : usersCreated;
  console.log(`   ${usersCreated.length} usuários criados (senha: demo123).`);

  // ── 3. Eventos ──────────────────────────────────────────────────────────
  console.log('📅  Criando eventos...');
  const eventoCount = await Evento.count();

  if (eventoCount < 5) {
    // distribuir 80 eventos: 40 passados, 10 semana atual, 30 futuros
    const eventosData: object[] = [];

    // Passados (-180 a -3 dias)
    for (let i = 0; i < 40; i++) {
      const daysAgo = -(Math.floor(Math.random() * 177) + 3);
      const inicio = randomHour(daysFromNow(daysAgo), pick([8, 9, 10, 14, 15, 16, 19]));
      const fim = new Date(inicio);
      fim.setHours(fim.getHours() + pick([1, 2, 3, 4]));
      const sec = pick(allSecs);
      const autor = pick(allUsers.filter(u => u.secretaria_id === sec.id) || allUsers);
      const status = pick(['concluido', 'concluido', 'publicado', 'cancelado', 'em_planejamento']);
      eventosData.push({
        titulo: TITULOS_EVENTOS[i % TITULOS_EVENTOS.length],
        descricao: `Evento organizado pela ${sec.nome}. Detalhes completos a serem confirmados pela equipe responsável. Todas as secretarias envolvidas foram notificadas.`,
        local: pick(LOCAIS),
        data_inicio: inicio,
        data_fim: fim,
        tipo: pick(TIPOS_EVENTO),
        status,
        secretaria_id: sec.id,
        criado_por: autor?.id ?? allUsers[0].id,
      });
    }

    // Semana atual (-2 a +7 dias)
    for (let i = 0; i < 12; i++) {
      const days = Math.floor(Math.random() * 9) - 2;
      const inicio = randomHour(daysFromNow(days), pick([8, 9, 10, 14, 15, 16, 19]));
      const fim = new Date(inicio);
      fim.setHours(fim.getHours() + pick([1, 2, 3]));
      const sec = pick(allSecs);
      const autor = pick(allUsers);
      eventosData.push({
        titulo: TITULOS_EVENTOS[(40 + i) % TITULOS_EVENTOS.length],
        descricao: `Evento da semana — ${sec.nome}. Presença confirmada da equipe de comunicação. Solicitar cobertura com 48h de antecedência.`,
        local: pick(LOCAIS),
        data_inicio: inicio,
        data_fim: fim,
        tipo: pick(TIPOS_EVENTO),
        status: pick(['em_producao', 'em_analise', 'em_planejamento', 'publicado']),
        secretaria_id: sec.id,
        criado_por: autor.id,
      });
    }

    // Futuros (+8 a +120 dias)
    for (let i = 0; i < 28; i++) {
      const days = Math.floor(Math.random() * 112) + 8;
      const inicio = randomHour(daysFromNow(days), pick([8, 9, 10, 14, 15, 16, 19]));
      const fim = new Date(inicio);
      fim.setHours(fim.getHours() + pick([1, 2, 3, 4, 6]));
      const sec = pick(allSecs);
      const autor = pick(allUsers);
      eventosData.push({
        titulo: TITULOS_EVENTOS[(52 + i) % TITULOS_EVENTOS.length],
        descricao: `Programação futura — ${sec.nome}. Evento em fase de planejamento. Confirmações de participação pendentes.`,
        local: pick(LOCAIS),
        data_inicio: inicio,
        data_fim: fim,
        tipo: pick(TIPOS_EVENTO),
        status: pick(['em_planejamento', 'em_planejamento', 'em_producao', 'em_analise']),
        secretaria_id: sec.id,
        criado_por: autor.id,
      });
    }

    await Evento.bulkCreate(eventosData);
    console.log(`   ${eventosData.length} eventos criados.`);
  } else {
    console.log(`   Eventos já existem (${eventoCount}), pulando.`);
  }

  // ── 4. Releases ─────────────────────────────────────────────────────────
  console.log('📰  Criando releases...');
  const releaseCount = await Release.count();

  if (releaseCount < 5) {
    const releasesData: object[] = [];

    for (let i = 0; i < TITULOS_RELEASES.length; i++) {
      const publicado = Math.random() > 0.3;
      const daysAgo = -(Math.floor(Math.random() * 120));
      const publicado_em = publicado ? daysFromNow(daysAgo) : null;
      const sec = pick(allSecs);

      releasesData.push({
        titulo: TITULOS_RELEASES[i],
        subtitulo: `Informativo oficial da ${sec.nome} — Para divulgação imediata`,
        conteudo: `<p><strong>${TITULOS_RELEASES[i]}</strong></p>
<p>A Prefeitura Municipal informa à população e aos veículos de comunicação que ${TITULOS_RELEASES[i].toLowerCase()}. A ação, coordenada pela ${sec.nome}, visa atender às demandas da população local e fortalecer os serviços públicos essenciais.</p>
<p>Segundo o titular da pasta, o objetivo é garantir qualidade de vida e bem-estar a todos os munícipes. "Estamos comprometidos com a transparência e a eficiência na gestão dos recursos públicos", destacou o secretário.</p>
<p>A iniciativa faz parte do Plano de Governo Municipal e conta com recursos oriundos do orçamento próprio e de convênios com os governos estadual e federal.</p>
<p>Para mais informações, entre em contato com a Secretaria de Comunicação pelo telefone (XX) 3000-0000 ou pelo e-mail secom@prefeitura.gov.br.</p>`,
        imagem_capa: null,
        publicado,
        publicado_em,
        agendado_para: null,
        secretaria_id: sec.id,
      });
    }

    await Release.bulkCreate(releasesData);
    console.log(`   ${releasesData.length} releases criados.`);
  } else {
    console.log(`   Releases já existem (${releaseCount}), pulando.`);
  }

  // ── 5. Solicitações ─────────────────────────────────────────────────────
  console.log('📋  Criando solicitações...');
  const solicCount = await Solicitacao.count();

  if (solicCount < 5) {
    const solicData: object[] = [];

    for (let i = 0; i < 80; i++) {
      const sec = pick(allSecs.filter(s => s.slug !== 'secom'));
      const autor = pick(allUsers.filter(u => u.secretaria_id === sec.id) || allUsers);
      const status = pick([
        'pendente', 'pendente', 'em_andamento', 'em_andamento',
        'concluido', 'concluido', 'cancelado',
      ]);

      solicData.push({
        titulo: TITULOS_SOLIC[i % TITULOS_SOLIC.length],
        descricao: `Solicitação da ${sec.nome}. ${TITULOS_SOLIC[i % TITULOS_SOLIC.length]}. Favor encaminhar ao responsável de comunicação para providências. Prazo estimado: 3 dias úteis.`,
        prioridade: pick(['baixa', 'media', 'media', 'alta']),
        tipo_midia: pick(TIPOS_MIDIA),
        status,
        secretaria_id: sec.id,
        criado_por: autor?.id ?? allUsers[0].id,
      });
    }

    const solicitacoesCriadas = await Solicitacao.bulkCreate(solicData, { returning: true });
    console.log(`   ${solicData.length} solicitações criadas.`);

    // ── 6. Comentários nas solicitações ────────────────────────────────────
    console.log('💬  Criando comentários...');
    const comentariosData: object[] = [];

    for (const sol of solicitacoesCriadas) {
      const numComent = Math.floor(Math.random() * 5); // 0–4 comentários
      const secomUsers = allUsers.filter(u => u.secretaria_id === secretariasMap['secom'].id);
      const comentAuthor = secomUsers.length > 0 ? pick(secomUsers) : pick(allUsers);

      for (let c = 0; c < numComent; c++) {
        comentariosData.push({
          solicitacao_id: sol.id,
          autor_id: comentAuthor.id,
          tipo: pick(['comentario', 'comentario', 'comentario', 'evento']),
          texto: pick(COMENTARIOS),
        });
      }
    }

    if (comentariosData.length > 0) {
      await SolicitacaoComentario.bulkCreate(comentariosData);
      console.log(`   ${comentariosData.length} comentários criados.`);
    }
  } else {
    console.log(`   Solicitações já existem (${solicCount}), pulando.`);
  }

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n✅  Seed de demonstração concluído!');
  console.log('─────────────────────────────────────');
  console.log(`   Secretarias : ${await Secretaria.count()}`);
  console.log(`   Usuários    : ${await User.count()}`);
  console.log(`   Eventos     : ${await Evento.count()}`);
  console.log(`   Releases    : ${await Release.count()}`);
  console.log(`   Solicitações: ${await Solicitacao.count()}`);
  console.log('─────────────────────────────────────');
  console.log('\n   Credenciais de acesso:');
  console.log('   admin@comunica.gov.br  → admin123   (Administrador)');
  console.log('   ana.paula.ferreira@prefeitura.demo.br → demo123  (SECOM)');
  console.log('   qualquer outro @prefeitura.demo.br    → demo123');

  await sequelize.close();
}

main().catch(err => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
