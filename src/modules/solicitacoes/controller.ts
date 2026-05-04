import { Request, Response } from 'express';
import SolicitacaoRepository from './repository.ts';
import { Secretaria } from '../../database/models/index.ts';

export const list = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    let where = {};
    
    // Non-admin/secom users only see their own secretariat's requests
    if (user.role === 'secretaria') {
      where = { secretaria_id: user.secretaria_id };
    }

    const solicitacoes = await SolicitacaoRepository.findAll(where);
    res.render('solicitacoes/index', { title: 'Minhas Solicitações', solicitacoes });
  } catch (error) {
    console.error('Error listing solicitacoes:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = async (req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ where: { ativo: true } });
    res.render('solicitacoes/create', { title: 'Nova Solicitação', secretarias });
  } catch (error) {
    console.error('Error creating solicitacao view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, descricao, prioridade, tipo_midia, secretaria_id } = req.body;
    const user = (req as any).session.user;

    await SolicitacaoRepository.create({
      titulo,
      descricao,
      prioridade,
      tipo_midia,
      secretaria_id: user.role === 'admin' || user.role === 'secom' ? secretaria_id : user.secretaria_id,
      criado_por: user.id,
      status: 'pendente'
    });

    res.redirect('/solicitacoes');
  } catch (error) {
    console.error('Error storing solicitacao:', error);
    res.status(500).send('Internal Server Error');
  }
};
