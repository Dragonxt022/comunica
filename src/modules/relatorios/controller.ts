import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import sequelize from '../../config/database.ts';
import { Release, Solicitacao, SolicitacaoComentario, SolicitacaoImagem, Secretaria, Evento, Inscricao, Municipio } from '../../database/models/index.ts';
import { getActiveMid } from '../../lib/municipio-filter.ts';
import {
  objetoContratoPadrao,
  OBJETIVO_SERVICO_PADRAO,
  ARQUIVOS_NUVEM_PADRAO,
  RESULTADOS_EVIDENCIAS_PADRAO,
  PROXIMAS_ETAPAS_PADRAO,
} from './mensal-textos-padrao.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

// Datas "YYYY-MM-DD" vindas de <input type="date"> são interpretadas como UTC por
// `new Date(string)`; combinado com startOfDay/endOfDay (que mutam em horário local),
// isso perdia um dia inteiro em fusos atrás de UTC (ex: America/Sao_Paulo). Construir
// a partir dos componentes evita o parse em UTC.
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Contraparte de parseDateOnly: formata em componentes locais, não via
// toISOString() (que converteria para UTC e poderia mudar o dia exibido).
function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDays(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function monthLabel(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function last6Months(refEnd: Date): { label: string; inicio: Date; fim: Date }[] {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(refEnd);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const inicio = startOfDay(d);
    const fim = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    months.push({ label: monthLabel(inicio), inicio, fim });
  }
  return months;
}

// ── main analytics ────────────────────────────────────────────────────────────

export const index = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;

    // Period
    let dtInicio: Date, dtFim: Date;
    const preset = String(req.query.periodo || 'mes');
    const customInicio = req.query.inicio as string;
    const customFim    = req.query.fim    as string;
    const now = new Date();

    if (customInicio && customFim) {
      dtInicio = startOfDay(parseDateOnly(customInicio));
      dtFim    = endOfDay(parseDateOnly(customFim));
    } else if (preset === 'mes') {
      dtInicio = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      dtFim    = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else {
      dtFim    = endOfDay(new Date());
      dtInicio = startOfDay(new Date());
      const dias = Number(preset) || 30;
      dtInicio.setDate(dtInicio.getDate() - dias);
    }

    const presetAtivo = (customInicio && customFim) ? 'custom' : preset;

    const isSuperAdmin = user.role === 'super_admin';
    const qMunicipio = req.query.municipio_id;
    let selectedMunicipioId: number | null = null;
    if (isSuperAdmin) {
      selectedMunicipioId = qMunicipio !== undefined ? (qMunicipio ? Number(qMunicipio) : null) : getActiveMid(req);
    }
    const municipioFilter = isSuperAdmin
      ? (selectedMunicipioId ? { municipio_id: selectedMunicipioId } : {})
      : { municipio_id: user.municipio_id };
    const secretariaFilter = (id?: string) => id ? { secretaria_id: Number(id) } : {};
    const secFilter = secretariaFilter(req.query.secretaria as string);

    // ── Busca base ──────────────────────────────────────────────────────────

    const [solicitacoes, releases, eventos, secretarias, municipios] = await Promise.all([
      Solicitacao.findAll({
        where: { createdAt: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter, ...secFilter },
        include: [{ model: Secretaria, as: 'secretaria', attributes: ['id','nome'] }],
        order: [['createdAt', 'DESC']],
      }) as Promise<any[]>,

      Release.findAll({
        where: { publicado: true, publicado_em: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter, ...secFilter },
        include: [{ model: Secretaria, as: 'secretaria', attributes: ['id','nome'] }],
        order: [['publicado_em', 'DESC']],
      }) as Promise<any[]>,

      Evento.findAll({
        where: { data_inicio: { [Op.between]: [dtInicio, dtFim] }, arquivado: false, ...municipioFilter, ...secFilter },
        include: [{ model: Secretaria, as: 'secretaria', attributes: ['id','nome'] }],
        order: [['data_inicio', 'DESC']],
      }) as Promise<any[]>,

      Secretaria.findAll({ where: { ativo: true, ...municipioFilter }, order: [['nome','ASC']] }) as Promise<any[]>,

      isSuperAdmin
        ? Municipio.findAll({ where: { ativo: true }, order: [['nome','ASC']] }) as Promise<any[]>
        : Promise.resolve([]),
    ]);

    const municipioNome = selectedMunicipioId
      ? (municipios.find((m: any) => m.id === selectedMunicipioId)?.nome || '')
      : '';

    // ── Solicitações — estatísticas ─────────────────────────────────────────

    const allIds = solicitacoes.map((s: any) => s.id);

    // Busca comentários de aprovação para calcular tempo de atendimento
    const aprovComments: any[] = allIds.length
      ? await SolicitacaoComentario.findAll({
          where: { solicitacao_id: { [Op.in]: allIds }, tipo: 'aprovacao' },
          attributes: ['solicitacao_id','createdAt'],
          order: [['createdAt','ASC']],
        }) as any[]
      : [];

    const aprovMap = new Map<number, Date>();
    for (const c of aprovComments) {
      if (!aprovMap.has(c.solicitacao_id)) aprovMap.set(c.solicitacao_id, new Date(c.createdAt));
    }

    // Por status
    const statusKeys = ['pendente','aprovado','produção','concluído','finalizado','cancelado'];
    const byStatus: Record<string,number> = {};
    for (const k of statusKeys) byStatus[k] = 0;
    for (const s of solicitacoes) {
      const st = (s.status || 'pendente').toLowerCase();
      if (byStatus[st] !== undefined) byStatus[st]++; else byStatus['pendente']++;
    }

    // Por tipo de mídia
    const byTipo: Record<string,number> = {};
    for (const s of solicitacoes) {
      const t = s.tipo_midia || 'Outros';
      byTipo[t] = (byTipo[t] || 0) + 1;
    }
    const tiposSorted = Object.entries(byTipo).sort((a,b) => b[1]-a[1]).map(([k,v]) => ({ label: k, count: v }));

    // Por secretaria
    const bySecSol: Record<number,{ nome:string; count:number; finalizadas:number }> = {};
    for (const s of solicitacoes) {
      const id = s.secretaria_id;
      const nome = s.secretaria?.nome || `Sec. ${id}`;
      if (!bySecSol[id]) bySecSol[id] = { nome, count: 0, finalizadas: 0 };
      bySecSol[id].count++;
      if (s.status === 'finalizado') bySecSol[id].finalizadas++;
    }
    const secSolList = Object.values(bySecSol).sort((a,b) => b.count - a.count);

    // Por prioridade
    const byPri: Record<string,number> = { baixa: 0, media: 0, alta: 0 };
    for (const s of solicitacoes) byPri[s.prioridade || 'media'] = (byPri[s.prioridade] || 0) + 1;

    // Tempo de atendimento
    const finalizados = solicitacoes.filter((s: any) => aprovMap.has(s.id));
    const diasAtendimento = finalizados.map((s: any) => diffDays(new Date(s.createdAt), aprovMap.get(s.id)!));
    const avgDias = diasAtendimento.length
      ? (diasAtendimento.reduce((a,b) => a+b, 0) / diasAtendimento.length)
      : 0;
    const minDias = diasAtendimento.length ? Math.min(...diasAtendimento) : 0;
    const maxDias = diasAtendimento.length ? Math.max(...diasAtendimento) : 0;

    // Prazo
    const comPrazo = solicitacoes.filter((s: any) => s.prazo);
    let noPrazo = 0, atrasadas = 0;
    for (const s of comPrazo) {
      const prazoDate = new Date(s.prazo);
      const fechouEm = aprovMap.get(s.id);
      if (fechouEm) {
        if (fechouEm <= prazoDate) noPrazo++; else atrasadas++;
      } else if (s.status !== 'finalizado' && prazoDate < new Date()) {
        atrasadas++;
      }
    }

    // Por mês (últimos 6)
    const meses = last6Months(dtFim);
    const byMonth = meses.map(m => {
      const abertas    = solicitacoes.filter((s: any) => new Date(s.createdAt) >= m.inicio && new Date(s.createdAt) <= m.fim).length;
      const fechadas   = solicitacoes.filter((s: any) => s.status === 'finalizado' && new Date(s.createdAt) >= m.inicio && new Date(s.createdAt) <= m.fim).length;
      return { label: m.label, abertas, fechadas };
    });

    // KPIs
    const finalizadas = byStatus['finalizado'] || 0;
    const emAndamento = (byStatus['pendente']||0) + (byStatus['aprovado']||0) + (byStatus['produção']||0) + (byStatus['concluído']||0);
    const taxaConclusao = solicitacoes.length ? Math.round(finalizadas / solicitacoes.length * 100) : 0;

    // Distribuição faixa de atendimento
    const faixas = [
      { label: '1 dia',     count: diasAtendimento.filter(d => d <= 1).length },
      { label: '2–3 dias',  count: diasAtendimento.filter(d => d >= 2 && d <= 3).length },
      { label: '4–7 dias',  count: diasAtendimento.filter(d => d >= 4 && d <= 7).length },
      { label: '8–15 dias', count: diasAtendimento.filter(d => d >= 8 && d <= 15).length },
      { label: '> 15 dias', count: diasAtendimento.filter(d => d > 15).length },
    ];

    // ── Releases ────────────────────────────────────────────────────────────

    const bySecRel: Record<number,{ nome:string; count:number }> = {};
    for (const r of releases) {
      const id = r.secretaria_id;
      const nome = r.secretaria?.nome || `Sec. ${id}`;
      if (!bySecRel[id]) bySecRel[id] = { nome, count: 0 };
      bySecRel[id].count++;
    }
    const relByMonth = meses.map(m => ({
      label: m.label,
      count: releases.filter((r: any) => new Date(r.publicado_em) >= m.inicio && new Date(r.publicado_em) <= m.fim).length,
    }));

    // ── Eventos ─────────────────────────────────────────────────────────────

    const evByStatus: Record<string,number> = {};
    const evByTipo:   Record<string,number> = {};
    for (const e of eventos) {
      const st = e.status || 'em_planejamento';
      evByStatus[st] = (evByStatus[st] || 0) + 1;
      const tp = e.tipo || 'Outros';
      evByTipo[tp] = (evByTipo[tp] || 0) + 1;
    }
    const comInscricoes = eventos.filter((e: any) => e.aceita_inscricoes).length;

    // Total de inscritos nos eventos do período
    const evIds = eventos.map((e: any) => e.id);
    let totalInscritos = 0;
    if (evIds.length) {
      totalInscritos = await Inscricao.count({ where: { evento_id: { [Op.in]: evIds }, status: { [Op.ne]: 'cancelado' } } });
    }

    // ── Render ──────────────────────────────────────────────────────────────

    res.render('relatorios/index', {
      title: 'Analíticos',
      secretarias,
      municipios,
      isSuperAdmin,
      // filters
      filtro: {
        periodo: preset,
        presetAtivo,
        inicio: formatDateOnly(dtInicio),
        fim:    formatDateOnly(dtFim),
        secretaria: req.query.secretaria || '',
        municipioId: selectedMunicipioId || '',
        municipioNome,
      },
      // sol
      sol: {
        total: solicitacoes.length,
        finalizadas,
        emAndamento,
        canceladas: byStatus['cancelado'] || 0,
        taxaConclusao,
        byStatus,
        byTipo: tiposSorted,
        bySec: secSolList,
        byPri,
        byMonth,
        avgDias: avgDias.toFixed(1),
        minDias,
        maxDias,
        noPrazo,
        atrasadas,
        semPrazo: solicitacoes.length - comPrazo.length,
        faixas,
        comPrazo: comPrazo.length,
      },
      rel: {
        total: releases.length,
        bySec: Object.values(bySecRel).sort((a,b) => b.count-a.count),
        byMonth: relByMonth,
      },
      ev: {
        total: eventos.length,
        comInscricoes,
        totalInscritos,
        byStatus: Object.entries(evByStatus).map(([k,v]) => ({ label: k, count: v as number })).sort((a,b) => b.count-a.count),
        byTipo: Object.entries(evByTipo).map(([k,v]) => ({ label: k, count: v as number })).sort((a,b) => b.count-a.count),
      },
    });
  } catch (error) {
    console.error('Error analytics index:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ── printable report (kept for the print modal) ──────────────────────────────

export const gerar = async (req: Request, res: Response) => {
  try {
    const { data_inicio, data_fim, secoes, secretaria_id, municipio_id } = req.body;
    const user = (req as any).session.user;
    const isSuperAdmin = user.role === 'super_admin';

    const dtInicio = startOfDay(parseDateOnly(data_inicio));
    const dtFim    = endOfDay(parseDateOnly(data_fim));
    const selectedMunicipioId = isSuperAdmin && municipio_id ? Number(municipio_id) : null;
    const municipioFilter = isSuperAdmin
      ? (selectedMunicipioId ? { municipio_id: selectedMunicipioId } : {})
      : { municipio_id: user.municipio_id };
    const secF = secretaria_id ? { secretaria_id: Number(secretaria_id) } : {};

    const municipioNome = isSuperAdmin
      ? (selectedMunicipioId ? (await Municipio.findByPk(selectedMunicipioId))?.nome || '' : '')
      : (await Municipio.findByPk(user.municipio_id))?.nome || '';
    const secoesArr: string[] = Array.isArray(secoes) ? secoes : (secoes ? [secoes] : ['sol','rel','ev']);

    const [solicitacoes, releases, eventos] = await Promise.all([
      secoesArr.includes('sol') ? Solicitacao.findAll({
        where: { createdAt: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter, ...secF },
        include: [{ model: Secretaria, as: 'secretaria', attributes: ['id','nome','cor'] }],
        order: [['createdAt', 'DESC']],
      }) as Promise<any[]> : Promise.resolve([]),

      secoesArr.includes('rel') ? Release.findAll({
        where: { publicado: true, publicado_em: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter, ...secF },
        include: [{ model: Secretaria, as: 'secretaria', attributes: ['id','nome','cor'] }],
        order: [['publicado_em', 'DESC']],
      }) as Promise<any[]> : Promise.resolve([]),

      secoesArr.includes('ev') ? Evento.findAll({
        where: { data_inicio: { [Op.between]: [dtInicio, dtFim] }, arquivado: false, ...municipioFilter, ...secF },
        include: [{ model: Secretaria, as: 'secretaria', attributes: ['id','nome','cor'] }],
        order: [['data_inicio', 'DESC']],
      }) as Promise<any[]> : Promise.resolve([]),
    ]);

    // compact stats for print
    const statBySt: Record<string,number> = {};
    const statByTipo: Record<string,number> = {};
    const statBySec: Record<string,number> = {};
    for (const s of solicitacoes as any[]) {
      statBySt[s.status] = (statBySt[s.status] || 0) + 1;
      statByTipo[s.tipo_midia] = (statByTipo[s.tipo_midia] || 0) + 1;
      const sn = s.secretaria?.nome || 'N/D';
      statBySec[sn] = (statBySec[sn] || 0) + 1;
    }

    res.render('relatorios/gerar', {
      title: 'Relatório',
      layout: 'layouts/print',
      periodoLabel: `${dtInicio.toLocaleDateString('pt-BR')} a ${dtFim.toLocaleDateString('pt-BR')}`,
      geradoEm: new Date().toLocaleString('pt-BR'),
      municipioNome: municipioNome || (isSuperAdmin ? 'Todos os municípios' : ''),
      secoes: secoesArr,
      solicitacoes,
      releases,
      eventos,
      statBySt,
      statByTipo,
      statBySec,
    });
  } catch (error) {
    console.error('Error gerar relatorio:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ── Relatório Mensal (modelo Cujubim) — formulário manual, sem persistência ──────

function formatarDataLonga(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const mensalForm = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const municipio = user.municipio_id ? await Municipio.findByPk(user.municipio_id) : null;
    const municipioNome = municipio?.nome || '';
    const uf = (municipio as any)?.estado || '';

    res.render('relatorios/mensal-form', {
      title: 'Relatório Mensal',
      municipioNome,
      uf,
      hojeISO: formatDateOnly(new Date()),
      objetoContratoPadrao: objetoContratoPadrao(municipioNome, uf),
      objetivoServicoPadrao: OBJETIVO_SERVICO_PADRAO,
      arquivosNuvemPadrao: ARQUIVOS_NUVEM_PADRAO,
      resultadosEvidenciasPadrao: RESULTADOS_EVIDENCIAS_PADRAO,
      proximasEtapasPadrao: PROXIMAS_ETAPAS_PADRAO,
    });
  } catch (error) {
    console.error('Error rendering relatorio mensal form:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Busca o que já existe no sistema para o período (vídeos e artes gráficas concluídos,
// releases publicados) para pré-preencher o formulário — evita redigitar o que a
// operação já registrou no dia a dia. Puro consulta ao banco, sem geração por IA.
export const mensalBuscarPeriodo = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const isSuperAdmin = user.role === 'super_admin';
    const { periodo_inicio, periodo_fim } = req.query as Record<string, string>;
    if (!periodo_inicio || !periodo_fim) {
      return res.status(400).json({ ok: false, error: 'Informe o período (início e fim).' });
    }

    const dtInicio = startOfDay(parseDateOnly(periodo_inicio));
    const dtFim = endOfDay(parseDateOnly(periodo_fim));
    const municipioFilter = isSuperAdmin ? {} : { municipio_id: user.municipio_id };
    const statusConcluidos = { [Op.in]: ['concluído', 'finalizado'] };

    // Não há um campo de "data de conclusão" dedicado em Solicitacao — usamos updatedAt
    // como aproximação de quando o material foi efetivamente entregue/concluído no período.
    const [videos, artes, releases] = await Promise.all([
      Solicitacao.findAll({
        where: { tipo_midia: 'Vídeo', status: statusConcluidos, updatedAt: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter },
        include: [{ model: SolicitacaoImagem, as: 'imagens', separate: true, order: [['ordem', 'ASC']] }],
        order: [['updatedAt', 'ASC']],
      }) as Promise<any[]>,
      Solicitacao.findAll({
        where: { tipo_midia: 'Arte Gráfica', status: statusConcluidos, updatedAt: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter },
        include: [{ model: SolicitacaoImagem, as: 'imagens', separate: true, order: [['ordem', 'ASC']] }],
        order: [['updatedAt', 'ASC']],
      }) as Promise<any[]>,
      Release.findAll({
        where: { publicado: true, publicado_em: { [Op.between]: [dtInicio, dtFim] }, ...municipioFilter },
        order: [['publicado_em', 'ASC']],
      }) as Promise<any[]>,
    ]);

    const imagensDe = (s: any): string[] =>
      s.imagens && s.imagens.length ? s.imagens.map((im: any) => im.url) : s.arte_final_url ? [s.arte_final_url] : [];

    res.json({
      ok: true,
      reels: videos.map((s) => ({ titulo: s.titulo, link: s.link_publicacao || '', imagemUrl: imagensDe(s)[0] || null })),
      releases: releases.map((r) => ({ titulo: r.titulo, link: r.link_publicacao || '', imagemUrl: r.print_publicacao_url || r.imagem_capa || null })),
      artes: {
        count: artes.reduce((acc, s) => acc + Math.max(imagensDe(s).length, 1), 0),
        imagens: artes.flatMap((s) => imagensDe(s)),
      },
    });
  } catch (error) {
    console.error('Error buscando dados do período para relatorio mensal:', error);
    res.status(500).json({ ok: false, error: 'Erro interno' });
  }
};

export const mensalGerar = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const files = ((req as any).files || []) as { fieldname: string; filename: string }[];

    const fileUrlByField = new Map<string, string>();
    for (const f of files) fileUrlByField.set(f.fieldname, `/uploads/relatorios/${f.filename}`);

    // Agrupa linhas dinâmicas (reel_titulo_0, reel_link_0, reel_imagem_0, ...) por índice,
    // ordenando numericamente — a ordem de chegada dos campos no FormData não é garantida.
    function coletarItens(prefixo: string): { idx: number; titulo: string; link: string; imagemUrl: string | null }[] {
      const idxs = new Set<number>();
      const re = new RegExp(`^${prefixo}_titulo_(\\d+)$`);
      for (const key of Object.keys(body)) {
        const m = key.match(re);
        if (m) idxs.add(Number(m[1]));
      }
      return Array.from(idxs)
        .sort((a, b) => a - b)
        .map((idx) => ({
          idx,
          titulo: String(body[`${prefixo}_titulo_${idx}`] || '').trim(),
          link: String(body[`${prefixo}_link_${idx}`] || '').trim(),
          // Upload novo tem prioridade; se nenhum arquivo foi enviado, usa a imagem já
          // existente no sistema (preenchida pelo "Buscar do período").
          imagemUrl: fileUrlByField.get(`${prefixo}_imagem_${idx}`) || String(body[`${prefixo}_imagem_existente_${idx}`] || '').trim() || null,
        }))
        .filter((item) => item.titulo);
    }

    const reels = coletarItens('reel');
    const releases = coletarItens('release');
    const artesImagensNovas = files.filter((f) => f.fieldname === 'artes_imagens').map((f) => `/uploads/relatorios/${f.filename}`);
    const artesImagensExistentes = (Array.isArray(body.artes_imagens_existentes)
      ? body.artes_imagens_existentes
      : body.artes_imagens_existentes ? [body.artes_imagens_existentes] : []
    ).filter(Boolean);
    const artesImagens = [...artesImagensExistentes, ...artesImagensNovas];

    const periodoInicio = body.periodo_inicio ? parseDateOnly(body.periodo_inicio) : new Date();
    const periodoFim = body.periodo_fim ? parseDateOnly(body.periodo_fim) : new Date();
    const dataAssinatura = body.data_assinatura ? parseDateOnly(body.data_assinatura) : new Date();

    res.render('relatorios/mensal-print', {
      title: `Relatório Mensal Nº ${body.numero || ''}/${body.ano || ''}`,
      layout: 'layouts/mensal-print',
      numero: body.numero || '',
      ano: body.ano || new Date().getFullYear(),
      contrato: body.contrato || '',
      contratante: body.contratante || '',
      periodoInicioFmt: formatarDataLonga(periodoInicio),
      periodoFimFmt: formatarDataLonga(periodoFim),
      objetoContrato: body.objeto_contrato || '',
      objetivoServico: body.objetivo_servico || '',
      arquivosNuvem: body.arquivos_nuvem || '',
      focoEditorial: body.foco_editorial || '',
      reels,
      artesCount: Number(body.artes_count) || 0,
      artesImagens,
      releases,
      resultadosEvidencias: body.resultados_evidencias || '',
      proximasEtapas: body.proximas_etapas || '',
      cidadeAssinatura: body.cidade_assinatura || '',
      dataAssinaturaFmt: formatarDataLonga(dataAssinatura),
    });
  } catch (error) {
    console.error('Error gerando relatorio mensal:', error);
    res.status(500).send('Internal Server Error');
  }
};
