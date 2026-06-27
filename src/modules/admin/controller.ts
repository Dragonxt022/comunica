import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { User, Secretaria, Configuracao, Municipio } from '../../database/models/index.ts';
import { bustConfigCache } from '../../lib/config-cache.ts';

const __filename_ctrl = fileURLToPath(import.meta.url);
const __dirname_ctrl  = path.dirname(__filename_ctrl);
const UPLOADS_ROOT    = path.resolve(__dirname_ctrl, '../../../public/uploads');

function fmtBytes(b: number): string {
  if (b === 0) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1_048_576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1_073_741_824) return (b / 1_048_576).toFixed(1) + ' MB';
  return (b / 1_073_741_824).toFixed(2) + ' GB';
}

function fileType(ext: string): string {
  if (['jpg','jpeg','png','webp','gif','avif','svg','bmp'].includes(ext)) return 'Imagens';
  if (['mp4','webm','avi','mov','mkv','m4v'].includes(ext)) return 'Vídeos';
  if (['pdf','doc','docx','xlsx','xls','ppt','pptx'].includes(ext)) return 'Documentos';
  return 'Outros';
}

interface FileEntry { name: string; relPath: string; size: number; ext: string; ftype: string; mtime: Date; }
interface DirResult { size: number; count: number; files: FileEntry[]; }

async function scanDir(dir: string, base: string = dir): Promise<DirResult> {
  const r: DirResult = { size: 0, count: 0, files: [] };
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = await scanDir(full, base);
        r.size += sub.size; r.count += sub.count; r.files.push(...sub.files);
      } else if (e.isFile()) {
        const stat = await fs.promises.stat(full);
        const ext = path.extname(e.name).toLowerCase().replace('.', '');
        r.size += stat.size; r.count++;
        r.files.push({ name: e.name, relPath: path.relative(base, full).replace(/\\/g, '/'), size: stat.size, ext, ftype: fileType(ext), mtime: stat.mtime });
      }
    }
  } catch { /* dir may not exist */ }
  return r;
}

export const storageView = async (req: Request, res: Response) => {
  try {
    // Disk info via df
    let diskTotal = 0, diskFree = 0;
    try {
      const dfOut = execSync(`df -B1 "${UPLOADS_ROOT}" 2>/dev/null | tail -1`).toString().trim().split(/\s+/);
      diskTotal = parseInt(dfOut[1] || '0', 10);
      diskFree  = parseInt(dfOut[3] || '0', 10);
    } catch { /* ignore */ }

    // Scan all uploads
    const total = await scanDir(UPLOADS_ROOT);

    // Category breakdown
    const cats = [
      { key: 'solicitacoes', label: 'Solicitações',   color: 'blue',   icon: 'clipboard' },
      { key: 'avatars',      label: 'Avatares',        color: 'purple', icon: 'users' },
      { key: 'regulamentos', label: 'Regulamentos',    color: 'orange', icon: 'file-text' },
    ];
    const catStats = await Promise.all(cats.map(async c => {
      const s = await scanDir(path.join(UPLOADS_ROOT, c.key));
      return { ...c, size: s.size, count: s.count, fmt: fmtBytes(s.size) };
    }));

    // Date-based folders (capas de eventos)
    const knownKeys = cats.map(c => c.key);
    let eventosSize = 0, eventosCount = 0;
    try {
      const dirs = await fs.promises.readdir(UPLOADS_ROOT, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory() && !knownKeys.includes(d.name) && /^\d{4}$/.test(d.name)) {
          const s = await scanDir(path.join(UPLOADS_ROOT, d.name));
          eventosSize += s.size; eventosCount += s.count;
        }
      }
    } catch { /* ignore */ }
    catStats.push({ key: 'eventos', label: 'Capas de Eventos', color: 'teal', icon: 'calendar', size: eventosSize, count: eventosCount, fmt: fmtBytes(eventosSize) });

    // File type breakdown
    const typeMap: Record<string, number> = {};
    for (const f of total.files) {
      typeMap[f.ftype] = (typeMap[f.ftype] || 0) + f.size;
    }
    const typeBreakdown = Object.entries(typeMap)
      .map(([type, size]) => ({ type, size, fmt: fmtBytes(size), pct: total.size > 0 ? Math.round(size / total.size * 100) : 0 }))
      .sort((a, b) => b.size - a.size);

    // Top 20 largest files
    const topFiles = total.files.slice().sort((a, b) => b.size - a.size).slice(0, 20);

    res.render('admin/armazenamento', {
      title: 'Armazenamento',
      total: { ...total, fmt: fmtBytes(total.size) },
      diskTotal, diskFree,
      diskUsedPct: diskTotal > 0 ? Math.min(Math.round((diskTotal - diskFree) / diskTotal * 100), 100) : 0,
      diskFmtTotal: fmtBytes(diskTotal),
      diskFmtFree:  fmtBytes(diskFree),
      uploadsPct: diskTotal > 0 ? Math.min(Math.round(total.size / diskTotal * 100), 100) : 0,
      catStats,
      typeBreakdown,
      topFiles,
      fmtBytes: (b: number) => fmtBytes(b),
    });
  } catch (error) {
    console.error('storageView error:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const deleteUploadFile = async (req: Request, res: Response) => {
  try {
    const rel = (req.body.relPath || '').replace(/\.\./g, '');  // sanitize traversal
    const fullPath = path.join(UPLOADS_ROOT, rel);
    if (!fullPath.startsWith(UPLOADS_ROOT + path.sep) && fullPath !== UPLOADS_ROOT) {
      return res.status(400).json({ ok: false, error: 'Caminho inválido' });
    }
    await fs.promises.unlink(fullPath);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

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
