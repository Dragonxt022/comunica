import { Request, Response } from 'express';
import FormularioTemplateRepository from './repository.ts';

export const list = async (req: Request, res: Response) => {
  try {
    const templates = await FormularioTemplateRepository.findAll();
    res.render('formularios/index', { title: 'Templates de Formulário', templates });
  } catch (error) {
    console.error('Error listing formulario templates:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = (_req: Request, res: Response) => {
  res.render('formularios/create', { title: 'Novo Template de Formulário' });
};

export const store = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const { nome, descricao, campos } = req.body;

    let camposArray: any[] = [];
    try { camposArray = JSON.parse(campos || '[]'); } catch { camposArray = []; }

    await FormularioTemplateRepository.create({
      nome,
      descricao: descricao || '',
      campos: JSON.stringify(camposArray),
      criado_por: user.id,
    });

    res.redirect('/formularios');
  } catch (error) {
    console.error('Error storing formulario template:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const editView = async (req: Request, res: Response) => {
  try {
    const template = await FormularioTemplateRepository.findById(Number(req.params.id));
    if (!template) return res.redirect('/formularios');
    res.render('formularios/edit', { title: 'Editar Template', template });
  } catch (error) {
    console.error('Error editing formulario template:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { nome, descricao, campos } = req.body;

    let camposArray: any[] = [];
    try { camposArray = JSON.parse(campos || '[]'); } catch { camposArray = []; }

    await FormularioTemplateRepository.update(id, {
      nome,
      descricao: descricao || '',
      campos: JSON.stringify(camposArray),
    });

    res.redirect('/formularios');
  } catch (error) {
    console.error('Error updating formulario template:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const destroy = async (req: Request, res: Response) => {
  try {
    await FormularioTemplateRepository.delete(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting formulario template:', error);
    res.status(500).json({ ok: false });
  }
};

export const preview = async (req: Request, res: Response) => {
  try {
    const template = await FormularioTemplateRepository.findById(Number(req.params.id));
    if (!template) return res.status(404).json({ ok: false });
    let campos: any[] = [];
    try { campos = JSON.parse((template as any).campos || '[]'); } catch { campos = []; }
    res.json({ ok: true, campos, nome: (template as any).nome });
  } catch (error) {
    console.error('Error previewing formulario template:', error);
    res.status(500).json({ ok: false });
  }
};
