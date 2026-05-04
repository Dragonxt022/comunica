import { Request, Response } from 'express';
import { Release } from '../../database/models/index.ts';

export const list = async (req: Request, res: Response) => {
  try {
    const releases = await Release.findAll({ order: [['created_at', 'DESC']] });
    res.render('releases/index', { title: 'Releases', releases });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = (req: Request, res: Response) => {
  res.render('releases/create', { title: 'Novo Release', errors: [] });
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, subtitulo, conteudo, publicado } = req.body;
    const isPublicado = publicado === 'on';
    await Release.create({
      titulo,
      subtitulo: subtitulo || null,
      conteudo,
      publicado: isPublicado,
      publicado_em: isPublicado ? new Date() : null,
    });
    res.redirect('/releases');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const editView = async (req: Request, res: Response) => {
  try {
    const release = await Release.findByPk(req.params.id);
    if (!release) return res.redirect('/releases');
    res.render('releases/edit', { title: 'Editar Release', release });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const release = await Release.findByPk(req.params.id);
    if (!release) return res.redirect('/releases');
    const { titulo, subtitulo, conteudo, publicado } = req.body;
    const isPublicado = publicado === 'on';
    await release.update({
      titulo,
      subtitulo: subtitulo || null,
      conteudo,
      publicado: isPublicado,
      publicado_em: isPublicado && !release.publicado ? new Date() : release.publicado_em,
    });
    res.redirect('/releases');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const destroy = async (req: Request, res: Response) => {
  try {
    await Release.destroy({ where: { id: req.params.id } });
    res.redirect('/releases');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const togglePublish = async (req: Request, res: Response) => {
  try {
    const release = await Release.findByPk(req.params.id);
    if (!release) return res.redirect('/releases');
    const nowPublicado = !release.publicado;
    await release.update({
      publicado: nowPublicado,
      publicado_em: nowPublicado ? new Date() : release.publicado_em,
    });
    res.redirect('/releases');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
