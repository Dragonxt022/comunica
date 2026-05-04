import { Request, Response } from 'express';
import EventoRepository from './repository.ts';
import { Secretaria } from '../../database/models/index.ts';

export const list = async (req: Request, res: Response) => {
  try {
    const eventos = await EventoRepository.findAll();
    res.render('eventos/index', { title: 'Calendário Institucional', eventos });
  } catch (error) {
    console.error('Error listing eventos:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = async (req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ where: { ativo: true } });
    res.render('eventos/create', { title: 'Novo Evento', secretarias });
  } catch (error) {
    console.error('Error creating evento view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, descricao, local, data_inicio, data_fim, tipo, secretaria_id } = req.body;
    const user = (req as any).session.user;

    await EventoRepository.create({
      titulo,
      descricao,
      local,
      data_inicio,
      data_fim,
      tipo,
      secretaria_id: user.role === 'admin' || user.role === 'secom' ? secretaria_id : user.secretaria_id,
      criado_por: user.id,
      status: 'pendente'
    });

    res.redirect('/eventos');
  } catch (error) {
    console.error('Error storing evento:', error);
    res.status(500).send('Internal Server Error');
  }
};
