import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { User, Secretaria, Configuracao, Municipio } from '../../database/models/index.ts';
import { bustConfigCache } from '../../lib/config-cache.ts';

// ─── Município Ativo (sessão do super_admin) ──────────────────────────────────

export const setMunicipioAtivo = (req: Request, res: Response) => {
  const { municipio_id } = req.body;
  const mid = municipio_id ? parseInt(municipio_id, 10) : null;
  (req as any).session.activeMunicipioId = mid;
  const referer = req.headers.referer || '/admin/secretarias';
  (req as any).session.save(() => res.redirect(referer));
};

// ─── Secretarias ──────────────────────────────────────────────────────────────

export const listSecretarias = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const rawMid = (req as any).session.activeMunicipioId;
    const activeMunicipioId = rawMid ? parseInt(String(rawMid), 10) : null;
    const where: any = {};
    if (user.role !== 'super_admin') {
      where.municipio_id = user.municipio_id;
    } else if (activeMunicipioId) {
      where.municipio_id = activeMunicipioId;
    }
    const secretarias = await Secretaria.findAll({
      where,
      include: [{ model: Municipio, as: 'municipio' }],
      order: [['nome', 'ASC']],
    });
    const municipios = user.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/secretarias', { title: 'Secretarias', secretarias, municipios, errors: [], form: {} });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const secretariasPorMunicipio = async (req: Request, res: Response) => {
  try {
    const { municipio_id } = req.query;
    const where: any = { ativo: true };
    if (municipio_id) where.municipio_id = municipio_id;
    const secretarias = await Secretaria.findAll({ where, order: [['nome', 'ASC']], attributes: ['id', 'nome'] });
    res.json(secretarias);
  } catch (error) {
    res.status(500).json([]);
  }
};

export const storeSecretaria = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).session.user;
    const { nome, cor, municipio_id } = req.body;
    const slug = slugify(nome, { lower: true, strict: true });
    const midFinal = sessionUser.role === 'super_admin' ? (municipio_id || null) : sessionUser.municipio_id;
    await Secretaria.create({ nome, slug, cor: cor || '#3b82f6', ativo: true, municipio_id: midFinal });
    res.redirect('/admin/secretarias');
  } catch (error: any) {
    const secretarias = await Secretaria.findAll({ order: [['nome', 'ASC']] });
    res.render('admin/secretarias', {
      title: 'Secretarias',
      secretarias,
      errors: [error.message],
      form: req.body,
    });
  }
};

export const updateSecretaria = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).session.user;
    const { nome, cor, ativo, municipio_id } = req.body;
    const slug = slugify(nome, { lower: true, strict: true });
    const updateData: any = { nome, slug, cor: cor || '#3b82f6', ativo: ativo === 'on' };
    if (sessionUser.role === 'super_admin' && municipio_id) updateData.municipio_id = municipio_id;
    await Secretaria.update(updateData, { where: { id: req.params.id } });
    res.redirect('/admin/secretarias');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/secretarias');
  }
};

export const destroySecretaria = async (req: Request, res: Response) => {
  try {
    await Secretaria.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/secretarias');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/secretarias');
  }
};

// ─── Secretarias (form views) ─────────────────────────────────────────────────

export const novaSecretariaView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const municipios = user.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/secretaria-form', { title: 'Nova Secretaria', secretaria: null, municipios, errors: [] });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const editSecretariaView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const secretaria = await Secretaria.findByPk(req.params.id);
    if (!secretaria) return res.redirect('/admin/secretarias');
    const municipios = user.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/secretaria-form', { title: 'Editar Secretaria', secretaria, municipios, errors: [] });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/secretarias');
  }
};

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const listUsuarios = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const rawMid = (req as any).session.activeMunicipioId;
    const activeMunicipioId = rawMid ? parseInt(String(rawMid), 10) : null;
    const userWhere: any = {};
    const secWhere: any = { ativo: true };
    if (user.role !== 'super_admin') {
      userWhere.municipio_id = user.municipio_id;
      secWhere.municipio_id = user.municipio_id;
    } else if (activeMunicipioId) {
      userWhere.municipio_id = activeMunicipioId;
      secWhere.municipio_id = activeMunicipioId;
    }
    const usuarios = await User.findAll({
      where: userWhere,
      include: [
        { model: Secretaria, as: 'secretaria' },
        { model: Municipio, as: 'municipio' },
      ],
      order: [['nome', 'ASC']],
    });
    const secretarias = await Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] });
    const municipios = user.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/usuarios', { title: 'Usuários', usuarios, secretarias, municipios, errors: [], form: {} });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const storeUsuario = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).session.user;
    const { nome, email, senha, role, secretaria_id, municipio_id } = req.body;
    const senha_hash = await bcrypt.hash(senha, 12);
    const midFinal = sessionUser.role === 'super_admin' ? (municipio_id || null) : sessionUser.municipio_id;
    await User.create({
      nome,
      email,
      senha_hash,
      role,
      secretaria_id: secretaria_id || null,
      municipio_id: midFinal,
      ativo: true,
    });
    res.redirect('/admin/usuarios');
  } catch (error: any) {
    const sessionUser = (req as any).session.user;
    const userWhere: any = {};
    const secWhere: any = { ativo: true };
    if (sessionUser.role !== 'super_admin') {
      userWhere.municipio_id = sessionUser.municipio_id;
      secWhere.municipio_id = sessionUser.municipio_id;
    }
    const usuarios = await User.findAll({
      where: userWhere,
      include: [{ model: Secretaria, as: 'secretaria' }, { model: Municipio, as: 'municipio' }],
      order: [['nome', 'ASC']],
    });
    const secretarias = await Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] });
    const municipios = sessionUser.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/usuarios', {
      title: 'Usuários',
      usuarios,
      secretarias,
      municipios,
      errors: [error.message],
      form: req.body,
    });
  }
};

export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).session.user;
    const { nome, email, role, secretaria_id, ativo, senha, municipio_id } = req.body;
    const updateData: any = { nome, email, role, secretaria_id: secretaria_id || null, ativo: ativo === 'on' };
    if (sessionUser.role === 'super_admin' && municipio_id) updateData.municipio_id = municipio_id;
    if (senha && senha.trim() !== '') {
      updateData.senha_hash = await bcrypt.hash(senha, 12);
    }
    await User.update(updateData, { where: { id: req.params.id } });
    res.redirect('/admin/usuarios');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/usuarios');
  }
};

export const toggleUsuarioAtivo = async (req: Request, res: Response) => {
  try {
    const usuario = await User.findByPk(req.params.id);
    if (usuario) {
      await usuario.update({ ativo: !usuario.ativo });
    }
    res.redirect('/admin/usuarios');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/usuarios');
  }
};

export const novoUsuarioView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const secWhere: any = { ativo: true };
    if (user.role !== 'super_admin') secWhere.municipio_id = user.municipio_id;
    const secretarias = await Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] });
    const municipios = user.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/usuario-form', { title: 'Novo Usuário', usuario: null, secretarias, municipios, errors: [] });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const editUsuarioView = async (req: Request, res: Response) => {
  try {
    const user = (req as any).session.user;
    const usuario = await User.findByPk(req.params.id, {
      include: [{ model: Secretaria, as: 'secretaria' }, { model: Municipio, as: 'municipio' }],
    });
    if (!usuario) return res.redirect('/admin/usuarios');
    const secWhere: any = { ativo: true };
    if (user.role !== 'super_admin') secWhere.municipio_id = user.municipio_id;
    const secretarias = await Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] });
    const municipios = user.role === 'super_admin' ? await Municipio.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] }) : [];
    res.render('admin/usuario-form', { title: 'Editar Usuário', usuario, secretarias, municipios, errors: [] });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const destroyUsuario = async (req: Request, res: Response) => {
  try {
    await User.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/usuarios');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/usuarios');
  }
};

// ─── Municípios (super_admin only) ───────────────────────────────────────────

export const listMunicipios = async (req: Request, res: Response) => {
  try {
    const municipios = await Municipio.findAll({ order: [['nome', 'ASC']] });
    const counts: Array<{ municipio: any; qtdSecretarias: number; qtdUsuarios: number }> = await Promise.all(
      municipios.map(async (m: any) => ({
        municipio: m,
        qtdSecretarias: await Secretaria.count({ where: { municipio_id: m.id } }),
        qtdUsuarios: await User.count({ where: { municipio_id: m.id } }),
      }))
    );
    res.render('admin/municipios', { title: 'Municípios', counts, errors: [], form: {} });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const novoMunicipioView = (_req: Request, res: Response) => {
  res.render('admin/municipio-form', { title: 'Novo Município', municipio: null, errors: [] });
};

export const storeMunicipio = async (req: Request, res: Response) => {
  try {
    const { nome, estado } = req.body;
    const slug = slugify(nome, { lower: true, strict: true });
    await Municipio.create({ nome, slug, estado: (estado || 'RO').toUpperCase(), ativo: true });
    res.redirect('/admin/municipios');
  } catch (error: any) {
    res.render('admin/municipio-form', { title: 'Novo Município', municipio: null, errors: [error.message] });
  }
};

export const editMunicipioView = async (req: Request, res: Response) => {
  try {
    const municipio = await Municipio.findByPk(req.params.id);
    if (!municipio) return res.redirect('/admin/municipios');
    res.render('admin/municipio-form', { title: 'Editar Município', municipio, errors: [] });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/municipios');
  }
};

export const updateMunicipio = async (req: Request, res: Response) => {
  try {
    const { nome, estado, ativo } = req.body;
    const slug = slugify(nome, { lower: true, strict: true });
    await Municipio.update(
      { nome, slug, estado: (estado || 'RO').toUpperCase(), ativo: ativo === 'on' },
      { where: { id: req.params.id } }
    );
    res.redirect('/admin/municipios');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/municipios');
  }
};

export const destroyMunicipio = async (req: Request, res: Response) => {
  try {
    const qtdSec = await Secretaria.count({ where: { municipio_id: req.params.id } });
    if (qtdSec > 0) {
      return res.redirect('/admin/municipios?erro=municipio_com_dados');
    }
    await Municipio.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/municipios');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/municipios');
  }
};

// ─── Configuracoes ────────────────────────────────────────────────────────────

export const configView = async (req: Request, res: Response) => {
  try {
    const config = await Configuracao.findOne({ where: { id: 1 } });
    const metas = config?.metas_midia ? JSON.parse(config.metas_midia as string) : [];
    res.render('admin/configuracoes', { title: 'Configurações', config, metas, success: false });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const saveConfig = async (req: Request, res: Response) => {
  try {
    const { titulo_site, subtitulo_site, descricao_site, email_contato, telefone_contato, instagram, facebook, youtube, twitter, whatsapp, site_oficial, status_eventos_json, metas_midia_json } = req.body;
    const [config] = await Configuracao.findOrCreate({ where: { id: 1 }, defaults: {} as any });
    await config.update({
      titulo_site, subtitulo_site, descricao_site,
      email_contato, telefone_contato, instagram, facebook, youtube, twitter, whatsapp, site_oficial,
      status_eventos: status_eventos_json || null,
      metas_midia: metas_midia_json || null,
    });
    bustConfigCache();
    const metas = config.metas_midia ? JSON.parse(config.metas_midia as string) : [];
    res.render('admin/configuracoes', { title: 'Configurações', config, metas, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
