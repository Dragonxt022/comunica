import { Request, Response } from 'express';
import { Evento, Secretaria } from '../../database/models/index.ts';

export const agendaPublica = async (req: Request, res: Response) => {
  try {
    const eventos = await Evento.findAll({
      where: { status: 'aprovado' },
      include: [{ model: Secretaria, as: 'secretaria' }],
      order: [['data_inicio', 'ASC']]
    });
    
    res.render('public/agenda', { title: 'Agenda da Imprensa', eventos, layout: 'layouts/public' });
  } catch (error) {
    console.error('Error public agenda:', error);
    res.status(500).send('Internal Server Error');
  }
};
