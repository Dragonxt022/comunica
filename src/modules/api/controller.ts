import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Evento, Secretaria, User, Solicitacao, SolicitacaoComentario } from '../../database/models/index.ts';
import { notificarRole } from '../../lib/notificacao.ts';

// GET /api/v1/eventos
// Query params: status, de (YYYY-MM-DD), ate (YYYY-MM-DD), secretaria_id, limit (max 100)
export const listEventos = async (req: Request, res: Response) => {
  try {
    const { status, de, ate, secretaria_id, limit } = req.query as Record<string, string>;
    const where: any = { arquivado: false };

    if (status) where.status = status;
    if (secretaria_id) where.secretaria_id = Number(secretaria_id);

    if (de || ate) {
      where.data_inicio = {};
      if (de) where.data_inicio[Op.gte] = new Date(de);
      if (ate) where.data_inicio[Op.lte] = new Date(ate + 'T23:59:59');
    }

    const take = Math.min(Number(limit) || 50, 100);

    const eventos = await Evento.findAll({
      where,
      include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome', 'cor'] }],
      order: [['data_inicio', 'ASC']],
      limit: take,
      attributes: ['id', 'titulo', 'descricao', 'local', 'data_inicio', 'data_fim', 'tipo', 'status', 'secretaria_id', 'createdAt'],
    });

    return res.json({
      total: eventos.length,
      data: eventos.map((e: any) => ({
        id: e.id,
        titulo: e.titulo,
        descricao: e.descricao,
        local: e.local,
        data_inicio: e.data_inicio,
        data_fim: e.data_fim,
        tipo: e.tipo,
        status: e.status,
        secretaria: e.secretaria ? { id: e.secretaria.id, nome: e.secretaria.nome, cor: e.secretaria.cor } : null,
        criado_em: e.createdAt,
      })),
    });
  } catch (error) {
    console.error('API listEventos error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
};

// GET /api/v1/solicitacoes
// Query params: status, prioridade, secretaria_id, q (busca no título), limit (max 100)
export const listSolicitacoes = async (req: Request, res: Response) => {
  try {
    const { status, prioridade, secretaria_id, q, limit } = req.query as Record<string, string>;
    const where: any = {};

    if (status) where.status = status;
    if (prioridade) where.prioridade = prioridade;
    if (secretaria_id) where.secretaria_id = Number(secretaria_id);
    if (q) where.titulo = { [Op.like]: `%${q}%` };

    const take = Math.min(Number(limit) || 50, 100);

    const solicitacoes = await Solicitacao.findAll({
      where,
      include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome', 'cor'] }],
      order: [['createdAt', 'DESC']],
      limit: take,
      attributes: ['id', 'titulo', 'descricao', 'prioridade', 'tipo_midia', 'status', 'prazo', 'secretaria_id', 'criado_por', 'createdAt', 'updatedAt'],
    });

    return res.json({
      total: solicitacoes.length,
      data: solicitacoes.map((s: any) => ({
        id: s.id,
        titulo: s.titulo,
        descricao: s.descricao,
        prioridade: s.prioridade,
        tipo_midia: s.tipo_midia,
        status: s.status,
        prazo: s.prazo,
        secretaria: s.secretaria ? { id: s.secretaria.id, nome: s.secretaria.nome, cor: s.secretaria.cor } : null,
        criado_em: s.createdAt,
        atualizado_em: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('API listSolicitacoes error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
};

// POST /api/v1/solicitacoes
// Body: { titulo, descricao, secretaria_id, tipo_midia, prioridade?, prazo? }
// O campo criado_por será o primeiro usuário ativo da secretaria informada (ou o admin)
export const createSolicitacao = async (req: Request, res: Response) => {
  try {
    const { titulo, descricao, secretaria_id, tipo_midia, prioridade, prazo } = req.body;

    // Validação básica
    if (!titulo?.trim() || !descricao?.trim() || !secretaria_id || !tipo_midia?.trim()) {
      return res.status(400).json({
        error: 'Campos obrigatórios: titulo, descricao, secretaria_id, tipo_midia',
      });
    }

    const secId = Number(secretaria_id);
    if (!secId || isNaN(secId)) {
      return res.status(400).json({ error: 'secretaria_id inválido' });
    }

    // Verifica se secretaria existe
    const secretaria = await Secretaria.findByPk(secId);
    if (!secretaria) {
      return res.status(404).json({ error: 'Secretaria não encontrada' });
    }

    // Encontra um usuário da secretaria para vincular como criador
    const responsavel = await User.findOne({
      where: { secretaria_id: secId, ativo: true },
      order: [['id', 'ASC']],
    });
    const adminUser = responsavel || (await User.findOne({ where: { role: 'admin', ativo: true }, order: [['id', 'ASC']] }));
    if (!adminUser) {
      return res.status(500).json({ error: 'Nenhum usuário ativo encontrado para registrar a solicitação' });
    }

    const prioridadeValida = ['baixa', 'media', 'alta'].includes(prioridade) ? prioridade : 'media';

    const sol = await Solicitacao.create({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      prioridade: prioridadeValida,
      tipo_midia: tipo_midia.trim(),
      prazo: prazo || null,
      secretaria_id: secId,
      criado_por: (adminUser as any).id,
      status: 'pendente',
    } as any);

    await SolicitacaoComentario.create({
      solicitacao_id: (sol as any).id,
      autor_id: (adminUser as any).id,
      tipo: 'evento',
      texto: 'Chamado aberto via assistente virtual.',
    } as any);

    notificarRole(['admin', 'secom'], {
      titulo: '📋 Nova solicitação (assistente)',
      corpo: `${titulo.trim()} (${tipo_midia.trim()})`,
      url: `/solicitacoes/${(sol as any).id}`,
      tipo: 'solicitacao_nova',
    }).catch(() => {});

    return res.status(201).json({
      id: (sol as any).id,
      titulo: (sol as any).titulo,
      status: (sol as any).status,
      secretaria: { id: (secretaria as any).id, nome: (secretaria as any).nome },
      criado_em: (sol as any).createdAt,
    });
  } catch (error) {
    console.error('API createSolicitacao error:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
};
