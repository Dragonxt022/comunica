import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Evento, Secretaria, FormularioTemplate } from '../../database/models/index.ts';
import InscricaoRepository from './repository.ts';

function canViewInscricoes(user: any, evento: any): boolean {
  if (user.role === 'admin' || user.role === 'secom') return true;
  if (user.role === 'secretaria' && evento.secretaria_id === user.secretaria_id) return true;
  return false;
}

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const eventoId = Number(req.params.eventoId);

    const evento = await Evento.findOne({
      where: { id: eventoId },
      include: [{ model: Secretaria, as: 'secretaria' }],
    }) as any;

    if (!evento) return res.redirect('/eventos');
    if (!canViewInscricoes(user, evento)) return res.status(403).redirect('/eventos');

    const { q, status: filtroStatus, ordenar = 'createdAt_DESC' } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = 25;

    const where: any = {};
    if (q) {
      where[Op.or as symbol] = [
        { nome: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { numero_inscricao: { [Op.like]: `%${q}%` } },
      ];
    }
    if (filtroStatus) where.status = filtroStatus;

    const [field, dir] = ordenar.split('_');
    const order: any = [[field || 'createdAt', dir || 'DESC']];

    const { count, rows: inscricoes } = await InscricaoRepository.findByEvento(
      eventoId, where, perPage, (page - 1) * perPage
    );

    const totalConfirmados = await InscricaoRepository.countByEvento(eventoId);

    res.render('inscricoes/index', {
      title: `Inscritos — ${evento.titulo}`,
      evento,
      inscricoes,
      totalConfirmados,
      q: q || '',
      filtroStatus: filtroStatus || '',
      ordenar,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
      total: count,
    });
  } catch (error) {
    console.error('Error listing inscricoes:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const show = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const eventoId = Number(req.params.eventoId);
    const inscricao = await InscricaoRepository.findById(Number(req.params.id)) as any;
    if (!inscricao || inscricao.evento_id !== eventoId) return res.redirect(`/eventos/${eventoId}/inscricoes`);

    const evento = inscricao.evento;
    if (!canViewInscricoes(user, evento)) return res.status(403).redirect('/eventos');

    let dados: Record<string, any> = {};
    try { dados = JSON.parse(inscricao.dados || '{}'); } catch { dados = {}; }

    let campos: any[] = [];
    if (evento.formulario_template_id) {
      const tpl = await FormularioTemplate.findOne({ where: { id: evento.formulario_template_id } }) as any;
      if (tpl) try { campos = JSON.parse(tpl.campos || '[]'); } catch { campos = []; }
    }

    res.render('inscricoes/show', {
      title: `Inscrição ${inscricao.numero_inscricao}`,
      inscricao,
      evento,
      dados,
      campos,
    });
  } catch (error) {
    console.error('Error showing inscricao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const eventoId = Number(req.params.eventoId);
    const id = Number(req.params.id);
    const { status } = req.body;

    const evento = await Evento.findOne({ where: { id: eventoId } }) as any;
    if (!evento || !canViewInscricoes(user, evento)) {
      return res.status(403).json({ ok: false, error: 'Sem permissão' });
    }

    const validStatus = ['confirmado', 'pendente', 'cancelado'];
    if (!validStatus.includes(status)) return res.status(400).json({ ok: false, error: 'Status inválido' });

    await InscricaoRepository.updateStatus(id, status);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error updating inscricao status:', error);
    return res.status(500).json({ ok: false });
  }
};

export const exportarCSV = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const eventoId = Number(req.params.eventoId);

    const evento = await Evento.findOne({
      where: { id: eventoId },
      include: [{ model: Secretaria, as: 'secretaria' }],
    }) as any;

    if (!evento || !canViewInscricoes(user, evento)) return res.status(403).redirect('/eventos');

    const { count, rows: inscricoes } = await InscricaoRepository.findByEvento(eventoId);

    let campos: any[] = [];
    if (evento.formulario_template_id) {
      const tpl = await FormularioTemplate.findOne({ where: { id: evento.formulario_template_id } }) as any;
      if (tpl) try { campos = JSON.parse(tpl.campos || '[]'); } catch { campos = []; }
    }

    const extraHeaders = campos.map((c: any) => c.label);
    const headerLine = ['Nº Inscrição', 'Nome', 'E-mail', 'Telefone', 'Status', 'Data', ...extraHeaders].join(';');

    const lines = (inscricoes as any[]).map(ins => {
      let dados: Record<string, any> = {};
      try { dados = JSON.parse(ins.dados || '{}'); } catch { dados = {}; }

      const base = [
        ins.numero_inscricao,
        ins.nome,
        ins.email,
        ins.telefone || '',
        ins.status,
        new Date(ins.createdAt).toLocaleString('pt-BR'),
      ];
      const extras = campos.map((c: any) => {
        const val = dados[c.id] || '';
        return Array.isArray(val) ? val.join(', ') : String(val);
      });
      return [...base, ...extras].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });

    const csv = [headerLine, ...lines].join('\r\n');
    const filename = `inscritos-${eventoId}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  } catch (error) {
    console.error('Error exporting inscricoes:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const configView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const eventoId = Number(req.params.eventoId);

    const evento = await Evento.findOne({
      where: { id: eventoId },
      include: [{ model: Secretaria, as: 'secretaria' }],
    }) as any;

    if (!evento) return res.redirect('/eventos');
    if (user.role === 'secretaria' && evento.secretaria_id !== user.secretaria_id) {
      return res.status(403).redirect('/eventos');
    }

    const templates = await FormularioTemplate.findAll({ order: [['nome', 'ASC']] });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const linkInscricao = evento.token_inscricao ? `${baseUrl}/inscricao/${evento.token_inscricao}` : null;

    res.render('inscricoes/config', {
      title: 'Configurar Inscrições',
      evento,
      templates,
      linkInscricao,
    });
  } catch (error) {
    console.error('Error config inscricoes view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const saveConfig = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const eventoId = Number(req.params.eventoId);

    const evento = await Evento.findOne({ where: { id: eventoId } }) as any;
    if (!evento) return res.redirect('/eventos');
    if (user.role === 'secretaria' && evento.secretaria_id !== user.secretaria_id) {
      return res.status(403).redirect('/eventos');
    }

    const { aceita_inscricoes, formulario_template_id, max_inscricoes, inscricoes_abertas } = req.body;

    const updates: any = {
      aceita_inscricoes: aceita_inscricoes === 'on' || aceita_inscricoes === '1' || aceita_inscricoes === 'true',
      formulario_template_id: formulario_template_id ? Number(formulario_template_id) : null,
      max_inscricoes: max_inscricoes && max_inscricoes !== '' ? Number(max_inscricoes) : null,
      inscricoes_abertas: inscricoes_abertas === 'on' || inscricoes_abertas === '1' || inscricoes_abertas === 'true',
    };

    // gera token único se ainda não existir e inscrições forem ativadas
    if (updates.aceita_inscricoes && !evento.token_inscricao) {
      const { randomBytes } = await import('crypto');
      updates.token_inscricao = randomBytes(12).toString('hex');
    }

    await Evento.update(updates, { where: { id: eventoId } });
    res.redirect(`/eventos/${eventoId}/inscricoes/config`);
  } catch (error) {
    console.error('Error saving inscricoes config:', error);
    res.status(500).send('Internal Server Error');
  }
};
