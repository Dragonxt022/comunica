import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import sequelize from '../../config/database.ts';
import { Release, Solicitacao, SolicitacaoComentario, Secretaria, Evento, Inscricao } from '../../database/models/index.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

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
    const preset = String(req.query.periodo || '30');
    const customInicio = req.query.inicio as string;
    const customFim    = req.query.fim    as string;

    if (customInicio && customFim) {
      dtInicio = startOfDay(new Date(customInicio));
      dtFim    = endOfDay(new Date(customFim));
    } else {
      dtFim    = endOfDay(new Date());
      dtInicio = startOfDay(new Date());
      const dias = Number(preset) || 30;
      dtInicio.setDate(dtInicio.getDate() - dias);
    }

    const municipioFilter = user.role !== 'super_admin' ? { municipio_id: user.municipio_id } : {};
    const secretariaFilter = (id?: string) => id ? { secretaria_id: Number(id) } : {};
    const secFilter = secretariaFilter(req.query.secretaria as string);

    // ── Busca base ──────────────────────────────────────────────────────────

    const [solicitacoes, releases, eventos, secretarias] = await Promise.all([
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
    ]);

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
      // filters
      filtro: {
        periodo: preset,
        inicio: dtInicio.toISOString().slice(0,10),
        fim:    dtFim.toISOString().slice(0,10),
        secretaria: req.query.secretaria || '',
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
    const { data_inicio, data_fim, secoes, secretaria_id } = req.body;
    const user = (req as any).session.user;

    const dtInicio = startOfDay(new Date(data_inicio));
    const dtFim    = endOfDay(new Date(data_fim));
    const municipioFilter = user.role !== 'super_admin' ? { municipio_id: user.municipio_id } : {};
    const secF = secretaria_id ? { secretaria_id: Number(secretaria_id) } : {};
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
