import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { User, Secretaria, Configuracao } from '../../database/models/index.ts';
import { bustConfigCache } from '../../lib/config-cache.ts';

// ─── Secretarias ──────────────────────────────────────────────────────────────

export const listSecretarias = async (req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ order: [['nome', 'ASC']] });
    res.render('admin/secretarias', { title: 'Secretarias', secretarias, errors: [], form: {} });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const storeSecretaria = async (req: Request, res: Response) => {
  try {
    const { nome, cor } = req.body;
    const slug = slugify(nome, { lower: true, strict: true });
    await Secretaria.create({ nome, slug, cor: cor || '#3b82f6', ativo: true });
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
    const { nome, cor, ativo } = req.body;
    const slug = slugify(nome, { lower: true, strict: true });
    await Secretaria.update(
      { nome, slug, cor: cor || '#3b82f6', ativo: ativo === 'on' },
      { where: { id: req.params.id } }
    );
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

export const novaSecretariaView = (req: Request, res: Response) => {
  res.render('admin/secretaria-form', { title: 'Nova Secretaria', secretaria: null, errors: [] });
};

export const editSecretariaView = async (req: Request, res: Response) => {
  try {
    const secretaria = await Secretaria.findByPk(req.params.id);
    if (!secretaria) return res.redirect('/admin/secretarias');
    res.render('admin/secretaria-form', { title: 'Editar Secretaria', secretaria, errors: [] });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/secretarias');
  }
};

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const listUsuarios = async (req: Request, res: Response) => {
  try {
    const usuarios = await User.findAll({
      include: [{ model: Secretaria, as: 'secretaria' }],
      order: [['nome', 'ASC']],
    });
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('admin/usuarios', { title: 'Usuários', usuarios, secretarias, errors: [], form: {} });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const storeUsuario = async (req: Request, res: Response) => {
  try {
    const { nome, email, senha, role, secretaria_id } = req.body;
    const senha_hash = await bcrypt.hash(senha, 12);
    await User.create({
      nome,
      email,
      senha_hash,
      role,
      secretaria_id: secretaria_id || null,
      ativo: true,
    });
    res.redirect('/admin/usuarios');
  } catch (error: any) {
    const usuarios = await User.findAll({
      include: [{ model: Secretaria, as: 'secretaria' }],
      order: [['nome', 'ASC']],
    });
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('admin/usuarios', {
      title: 'Usuários',
      usuarios,
      secretarias,
      errors: [error.message],
      form: req.body,
    });
  }
};

export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const { nome, email, role, secretaria_id, ativo, senha } = req.body;
    const updateData: any = { nome, email, role, secretaria_id: secretaria_id || null, ativo: ativo === 'on' };
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
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('admin/usuario-form', { title: 'Novo Usuário', usuario: null, secretarias, errors: [] });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const editUsuarioView = async (req: Request, res: Response) => {
  try {
    const usuario = await User.findByPk(req.params.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    });
    if (!usuario) return res.redirect('/admin/usuarios');
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    res.render('admin/usuario-form', { title: 'Editar Usuário', usuario, secretarias, errors: [] });
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

// ─── Configuracoes ────────────────────────────────────────────────────────────

export const configView = async (req: Request, res: Response) => {
  try {
    const config = await Configuracao.findOne({ where: { id: 1 } });
    res.render('admin/configuracoes', { title: 'Configurações', config, success: false });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const saveConfig = async (req: Request, res: Response) => {
  try {
    const { titulo_site, subtitulo_site, descricao_site, email_contato, telefone_contato, instagram, site_oficial, status_eventos_json } = req.body;
    const [config] = await Configuracao.findOrCreate({ where: { id: 1 }, defaults: {} as any });
    await config.update({
      titulo_site, subtitulo_site, descricao_site,
      email_contato, telefone_contato, instagram, site_oficial,
      status_eventos: status_eventos_json || null,
    });
    bustConfigCache();
    res.render('admin/configuracoes', { title: 'Configurações', config, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
