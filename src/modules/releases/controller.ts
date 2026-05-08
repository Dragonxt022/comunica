import { Request, Response } from 'express';
import path from 'path';
import { Op } from 'sequelize';
import { Release, Secretaria } from '../../database/models/index.ts';

export const list = async (req: Request, res: Response) => {
  try {
    const { q, secretaria, status } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = 15;

    // Auto-publish scheduled releases past their time
    await Release.update(
      { publicado: true },
      { where: { publicado: false, agendado_para: { [Op.lte]: new Date() } } }
    );

    const where: any = {};
    if (q) where.titulo = { [Op.like]: `%${q}%` };
    if (secretaria) where.secretaria_id = secretaria;
    if (status === 'publicado') where.publicado = true;
    if (status === 'rascunho') { where.publicado = false; where.agendado_para = null; }
    if (status === 'agendado') { where.publicado = false; where.agendado_para = { [Op.ne]: null }; }

    const [{ count, rows: releases }, secretarias] = await Promise.all([
      Release.findAndCountAll({
        where,
        include: [{ model: Secretaria, as: 'secretaria' }],
        order: [['created_at', 'DESC']],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }),
    ]);

    const totalPages = Math.ceil(count / perPage);
    res.render('releases/index', {
      title: 'Releases',
      releases,
      secretarias,
      q: q || '',
      filtroSecretaria: secretaria || '',
      filtroStatus: status || '',
      currentPage: page,
      totalPages,
      total: count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const createView = async (_req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('releases/create', { title: 'Novo Release', errors: [], useQuill: true, secretarias });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const store = async (req: Request, res: Response) => {
  try {
    const { titulo, subtitulo, conteudo, imagem_capa, secretaria_id, publicacao_tipo, agendado_para } = req.body;
    const isPublicado = publicacao_tipo === 'publicar';
    const agendadoPara = publicacao_tipo === 'agendar' && agendado_para ? new Date(agendado_para) : null;

    await Release.create({
      titulo,
      subtitulo:     subtitulo    || null,
      conteudo,
      imagem_capa:   imagem_capa  || null,
      secretaria_id: secretaria_id || null,
      publicado:     isPublicado,
      publicado_em:  isPublicado ? new Date() : (agendadoPara || null),
      agendado_para: agendadoPara,
    });
    res.redirect('/releases');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const editView = async (req: Request, res: Response) => {
  try {
    const release = await Release.findByPk(req.params.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    });
    if (!release) return res.redirect('/releases');
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('releases/edit', { title: 'Editar Release', release, useQuill: true, secretarias });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const release = await Release.findByPk(req.params.id);
    if (!release) return res.redirect('/releases');
    const { titulo, subtitulo, conteudo, imagem_capa, secretaria_id, publicacao_tipo, agendado_para, link_publicacao } = req.body;
    const isPublicado = publicacao_tipo === 'publicar';
    const agendadoPara = publicacao_tipo === 'agendar' && agendado_para ? new Date(agendado_para) : null;

    const file = (req as any).file;
    let printUrl: string | undefined;
    if (file) {
      const pubDir = path.join(process.cwd(), 'public');
      printUrl = '/' + path.relative(pubDir, file.path).split(path.sep).join('/');
    }

    await release.update({
      titulo,
      subtitulo:             subtitulo   || null,
      conteudo,
      imagem_capa:           imagem_capa !== undefined ? (imagem_capa || null) : release.imagem_capa,
      secretaria_id:         secretaria_id || null,
      publicado:             isPublicado,
      publicado_em:          isPublicado ? (release.publicado ? release.publicado_em : new Date()) : (agendadoPara || null),
      agendado_para:         agendadoPara,
      link_publicacao:       link_publicacao?.trim() || release.link_publicacao,
      print_publicacao_url:  printUrl !== undefined ? printUrl : release.print_publicacao_url,
      print_publicacao_nome: file ? file.originalname : release.print_publicacao_nome,
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
      publicado:     nowPublicado,
      publicado_em:  nowPublicado ? new Date() : release.publicado_em,
      agendado_para: nowPublicado ? null : release.agendado_para,
    });
    res.redirect('/releases');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const uploadImagem = (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file) return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado' });
  const pubDir = path.join(process.cwd(), 'public');
  const url = '/' + path.relative(pubDir, file.path).split(path.sep).join('/');
  return res.json({ ok: true, url });
};
