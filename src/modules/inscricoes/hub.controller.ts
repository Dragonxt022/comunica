import { Request, Response } from 'express';
import sequelize from '../../config/database.ts';
import { Evento, Secretaria, Inscricao } from '../../database/models/index.ts';

export const hub = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;

    const where: any = { aceita_inscricoes: true };
    if (user.role === 'secretaria') {
      where.secretaria_id = user.secretaria_id;
    }

    const eventos = await Evento.findAll({
      where,
      include: [{ model: Secretaria, as: 'secretaria', attributes: ['id', 'nome', 'cor'] }],
      order: [['data_inicio', 'DESC']],
    }) as any[];

    const eventoIds = eventos.map((e: any) => e.id);
    const countMap: Record<number, number> = {};

    if (eventoIds.length > 0) {
      const counts = await Inscricao.findAll({
        where: { evento_id: eventoIds },
        attributes: ['evento_id', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
        group: ['evento_id'],
        raw: true,
      }) as any[];
      counts.forEach((c: any) => { countMap[Number(c.evento_id)] = parseInt(c.total, 10); });
    }

    const totalInscricoes = Object.values(countMap).reduce((a, b) => a + b, 0);
    const totalAbertos = eventos.filter((e: any) => e.inscricoes_abertas).length;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.render('inscricoes/hub', {
      title: 'Inscrições',
      eventos,
      countMap,
      totalInscricoes,
      totalAbertos,
      baseUrl,
    });
  } catch (error) {
    console.error('Error hub inscricoes:', error);
    res.status(500).send('Internal Server Error');
  }
};
