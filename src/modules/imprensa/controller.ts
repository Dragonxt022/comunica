import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Evento, Secretaria, Release } from '../../database/models/index.ts';

export const agendaPublica = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const [eventos, releases] = await Promise.all([
      Evento.findAll({
        where: { status: 'publicado', data_inicio: { [Op.gte]: now } },
        include: [{ model: Secretaria, as: 'secretaria' }],
        order: [['data_inicio', 'ASC']]
      }),
      Release.findAll({
        where: {
          [Op.or]: [
            { publicado: true },
            { agendado_para: { [Op.lte]: now }, publicado: false },
          ],
        },
        order: [['publicado_em', 'DESC']],
        limit: 9
      })
    ]);
    res.render('public/agenda', {
      title: 'Agenda Oficial',
      eventos,
      releases,
      layout: 'layouts/public'
    });
  } catch (error) {
    console.error('Error public agenda:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const detalheRelease = async (req: Request, res: Response) => {
  try {
    const release = await Release.findOne({
      where: { id: req.params.id, publicado: true }
    });
    if (!release) {
      return res.status(404).redirect('/imprensa/agenda');
    }
    res.render('public/release-detalhe', {
      title: release.titulo,
      release,
      layout: 'layouts/public'
    });
  } catch (error) {
    console.error('Error release detalhe:', error);
    res.status(500).send('Internal Server Error');
  }
};
