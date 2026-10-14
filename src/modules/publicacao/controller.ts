import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Solicitacao, Secretaria, SolicitacaoComentario } from '../../database/models/index.ts';
import { secretariaWhere, getActiveMid } from '../../lib/municipio-filter.ts';
import { sseBroker } from '../../lib/sse.ts';

// Status em que o material já está pronto e pode ser publicado.
const STATUS_PRONTO = ['concluído', 'finalizado'];

const podePublicar = (user: any) => ['admin', 'secom', 'super_admin'].includes(user?.role);

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const mid = getActiveMid(req);
    const { q, secretaria, tipo, atrasadas, aba } = req.query as Record<string, string>;
    const abaAtiva = aba === 'publicadas' ? 'publicadas' : 'a_publicar';

    const base = secretariaWhere(user, {}, mid);
    const whereA: any = { ...base, publicado: false, status: { [Op.in]: STATUS_PRONTO } };
    const whereP: any = { ...base, publicado: true };
    if (q) { whereA.titulo = { [Op.like]: `%${q}%` }; whereP.titulo = { [Op.like]: `%${q}%` }; }
    if (secretaria) { whereA.secretaria_id = Number(secretaria); whereP.secretaria_id = Number(secretaria); }
    if (tipo) { whereA.tipo_midia = tipo; whereP.tipo_midia = tipo; }
    if (atrasadas === '1') {
      whereA.prazo = { [Op.ne]: null, [Op.lt]: hojeISO() };
    }

    const secWhere: any = { ativo: true };
    if (user.role !== 'super_admin') secWhere.municipio_id = user.municipio_id;

    const [aPublicar, publicadas, secretarias, totalAPublicar, totalPublicadas] = await Promise.all([
      abaAtiva === 'a_publicar'
        ? Solicitacao.findAll({
            where: whereA,
            include: [{ model: Secretaria, as: 'secretaria' }],
            order: [['prazo', 'ASC'], ['prioridade', 'ASC']],
          })
        : Promise.resolve([]),
      abaAtiva === 'publicadas'
        ? Solicitacao.findAll({
            where: whereP,
            include: [{ model: Secretaria, as: 'secretaria' }],
            order: [['data_publicacao', 'DESC']],
            limit: 300,
          })
        : Promise.resolve([]),
      Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] }),
      Solicitacao.count({ where: { ...base, publicado: false, status: { [Op.in]: STATUS_PRONTO } } }),
      Solicitacao.count({ where: { ...base, publicado: true } }),
    ]);

    res.render('publicacao/index', {
      title: 'Publicação',
      abaAtiva,
      aPublicar,
      publicadas,
      secretarias,
      totalAPublicar,
      totalPublicadas,
      podePublicar: podePublicar(user),
      filtros: {
        q: q || '',
        secretaria: secretaria || '',
        tipo: tipo || '',
        atrasadas: atrasadas === '1',
      },
    });
  } catch (error) {
    console.error('Error listing publicacao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const pendentesCount = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const mid = getActiveMid(req);
    const count = await Solicitacao.count({
      where: { ...secretariaWhere(user, {}, mid), publicado: false, status: { [Op.in]: STATUS_PRONTO } },
    });
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
};

export const publicar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!podePublicar(user)) return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const id = Number(req.params.id);
    const sol: any = await Solicitacao.findByPk(id);
    if (!sol) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada.' });

    const { data_publicacao, link_publicacao } = req.body;
    const updates: any = {
      publicado: true,
      data_publicacao: data_publicacao ? new Date(data_publicacao) : new Date(),
    };
    if (link_publicacao !== undefined) updates.link_publicacao = String(link_publicacao).trim() || sol.link_publicacao || null;

    await sol.update(updates);
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'evento',
      texto: `Marcada como publicada${updates.link_publicacao ? ': ' + updates.link_publicacao : ''}`,
    }).catch(() => {});
    sseBroker.broadcast({ type: 'solicitacao_status', id, updatedById: user.id });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error publishing solicitacao:', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível marcar como publicada.' });
  }
};

export const despublicar = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    if (!podePublicar(user)) return res.status(403).json({ ok: false, error: 'Sem permissão' });

    const id = Number(req.params.id);
    const sol: any = await Solicitacao.findByPk(id);
    if (!sol) return res.status(404).json({ ok: false, error: 'Solicitação não encontrada.' });

    await sol.update({ publicado: false, data_publicacao: null });
    await SolicitacaoComentario.create({
      solicitacao_id: id,
      autor_id: user.id,
      tipo: 'evento',
      texto: 'Publicação desfeita.',
    }).catch(() => {});
    sseBroker.broadcast({ type: 'solicitacao_status', id, updatedById: user.id });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error unpublishing solicitacao:', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível desfazer a publicação.' });
  }
};
