import { Request, Response } from 'express';
import { User, Secretaria, Municipio } from '../../database/models/index.ts';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { sessionStore } from '../../lib/session-store.ts';
import { parseUserAgent } from '../../lib/device.ts';
import { enviarCodigoVerificacao, confirmarCodigoVerificacao } from '../../lib/whatsapp.ts';

export const perfilView = async (req: Request, res: Response) => {
  try {
    const usuario = await User.findByPk((req as any).session.user.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    });
    res.render('perfil', { title: 'Meu Perfil', usuario, success: false, error: null });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const perfilUpdate = async (req: Request, res: Response) => {
  const sessionUser = (req as any).session.user;
  try {
    const { nome, email, celular, senha_atual, nova_senha, whatsapp_notificacoes_ativo } = req.body;
    const usuario = await User.findByPk(sessionUser.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    });
    if (!usuario) return res.redirect('/perfil');

    const updates: Record<string, any> = { nome, email, celular: celular || null };

    // O toggle só existe na tela quando o número já foi verificado por OTP — ativar/desativar
    // aqui não exige reverificação, só troca o número via o fluxo dedicado em /perfil/whatsapp/*.
    if ((usuario as any).whatsapp_numero) {
      updates.whatsapp_notificacoes_ativo = whatsapp_notificacoes_ativo === 'on';
    }

    // Handle avatar upload
    if ((req as any).file) {
      if (usuario.avatar) {
        const oldPath = path.join(process.cwd(), 'public', usuario.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updates.avatar = '/uploads/avatars/' + (req as any).file.filename;
    }

    // Handle password change
    if (nova_senha && nova_senha.trim()) {
      if (!senha_atual) {
        return res.render('perfil', { title: 'Meu Perfil', usuario, success: false, error: 'Informe a senha atual para alterá-la.' });
      }
      const ok = await usuario.checkPassword(senha_atual);
      if (!ok) {
        return res.render('perfil', { title: 'Meu Perfil', usuario, success: false, error: 'Senha atual incorreta.' });
      }
      updates.senha_hash = await bcrypt.hash(nova_senha, 12);
    }

    await usuario.update(updates);

    sessionUser.nome = nome;
    sessionUser.email = email;
    sessionUser.celular = celular || null;
    if (updates.avatar) sessionUser.avatar = updates.avatar;
    if ('whatsapp_notificacoes_ativo' in updates) sessionUser.whatsapp_notificacoes_ativo = updates.whatsapp_notificacoes_ativo;

    const updated = await User.findByPk(sessionUser.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    });
    res.render('perfil', { title: 'Meu Perfil', usuario: updated, success: true, error: null });
  } catch (error: any) {
    const usuario = await User.findByPk(sessionUser.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    }).catch(() => null);
    res.render('perfil', { title: 'Meu Perfil', usuario, success: false, error: error.message });
  }
};

export const loginView = (req: Request, res: Response) => {
  if ((req as any).session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', { title: 'Login', layout: 'layouts/blank', error: null });
};

export const login = async (req: Request, res: Response) => {
  const { email, senha } = req.body;

  try {
    const user = await User.findOne({
      where: { email, ativo: true },
      include: [
        { model: Secretaria, as: 'secretaria' },
        { model: Municipio, as: 'municipio' },
      ],
    });

    if (!user || !(await user.checkPassword(senha))) {
      return res.render('auth/login', { 
        title: 'Login', 
        layout: 'layouts/blank', 
        error: 'Credenciais inválidas ou conta inativa.' 
      });
    }

    user.ultimo_login = new Date();
    await user.save();

    (req as any).session.user = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      secretaria_id: user.secretaria_id,
      secretaria_nome: user.secretaria?.nome || null,
      municipio_id: user.municipio_id,
      municipio_nome: (user as any).municipio?.nome || null,
      avatar: user.avatar || null,
      celular: user.celular || null,
      whatsapp_numero: (user as any).whatsapp_numero || null,
      whatsapp_notificacoes_ativo: (user as any).whatsapp_notificacoes_ativo || false,
      whatsapp_prompt_snooze_until: (user as any).whatsapp_prompt_snooze_until || null,
    };

    (req as any).session.deviceInfo = {
      userAgent: req.headers['user-agent'] || null,
      ip: req.ip,
      criadoEm: new Date().toISOString(),
    };

    (req as any).session.save((err: any) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('auth/login', {
          title: 'Login',
          layout: 'layouts/blank',
          error: 'Erro ao iniciar sessão.'
        });
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { 
      title: 'Login', 
      layout: 'layouts/blank', 
      error: 'Ocorreu um erro no servidor. Tente novamente.' 
    });
  }
};

export const logout = (req: Request, res: Response) => {
  (req as any).session.destroy(() => {
    res.redirect('/login');
  });
};

export const dispositivosView = async (req: Request, res: Response) => {
  const sessionUser = (req as any).session.user;
  const currentSid = (req as any).sessionID;
  try {
    const rows = await (sessionStore as any).sessionModel.findAll();
    const dispositivos = rows
      .map((row: any) => {
        let data: any;
        try { data = JSON.parse(row.data); } catch { return null; }
        if (!data.user || data.user.id !== sessionUser.id) return null;
        const ua = parseUserAgent(data.deviceInfo?.userAgent);
        return {
          sid: row.sid,
          atual: row.sid === currentSid,
          label: ua.label,
          ip: data.deviceInfo?.ip || null,
          criadoEm: data.deviceInfo?.criadoEm || null,
        };
      })
      .filter((d: any) => d !== null)
      .sort((a: any, b: any) => (b.atual ? 1 : 0) - (a.atual ? 1 : 0));

    res.render('auth/dispositivos', { title: 'Dispositivos', dispositivos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro interno');
  }
};

export const encerrarDispositivo = async (req: Request, res: Response) => {
  const sessionUser = (req as any).session.user;
  const { senha } = req.body;
  const { sid } = req.params;
  try {
    if ((req as any).sessionID === sid) {
      return res.status(400).json({ ok: false, error: 'Use "Sair" para encerrar o dispositivo atual.' });
    }
    if (!senha) {
      return res.status(400).json({ ok: false, error: 'Informe sua senha.' });
    }

    const usuario = await User.findByPk(sessionUser.id);
    if (!usuario || !(await usuario.checkPassword(senha))) {
      return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
    }

    const row: any = await (sessionStore as any).sessionModel.findOne({ where: { sid } });
    if (!row) return res.status(404).json({ ok: false, error: 'Sessão não encontrada.' });
    const data = JSON.parse(row.data);
    if (!data.user || data.user.id !== sessionUser.id) {
      return res.status(403).json({ ok: false, error: 'Não autorizado.' });
    }

    await new Promise<void>((resolve, reject) => {
      sessionStore.destroy(sid, (err: any) => (err ? reject(err) : resolve()));
    });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Erro interno.' });
  }
};

// ─── WhatsApp — verificação de número (OTP) ─────────────────────────────────

export const whatsappEnviarCodigo = async (req: Request, res: Response) => {
  const sessionUser = (req as any).session.user;
  try {
    const { numero } = req.body;
    if (!numero) return res.status(400).json({ ok: false, error: 'Informe um número.' });
    const result = await enviarCodigoVerificacao(sessionUser.id, numero);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    console.error('Erro ao enviar código WhatsApp:', error);
    res.status(500).json({ ok: false, error: 'Erro interno.' });
  }
};

export const whatsappConfirmarCodigo = async (req: Request, res: Response) => {
  const sessionUser = (req as any).session.user;
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ ok: false, error: 'Informe o código recebido.' });
    const result = await confirmarCodigoVerificacao(sessionUser.id, codigo);
    if (!result.ok) return res.status(400).json(result);

    const usuario = await User.findByPk(sessionUser.id);
    sessionUser.whatsapp_numero = (usuario as any)?.whatsapp_numero || null;
    sessionUser.whatsapp_notificacoes_ativo = (usuario as any)?.whatsapp_notificacoes_ativo || false;
    res.json({ ok: true, numero: sessionUser.whatsapp_numero });
  } catch (error) {
    console.error('Erro ao confirmar código WhatsApp:', error);
    res.status(500).json({ ok: false, error: 'Erro interno.' });
  }
};

export const whatsappSnooze = async (req: Request, res: Response) => {
  const sessionUser = (req as any).session.user;
  try {
    const snoozeUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await User.update({ whatsapp_prompt_snooze_until: snoozeUntil } as any, { where: { id: sessionUser.id } });
    sessionUser.whatsapp_prompt_snooze_until = snoozeUntil;
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao adiar aviso de WhatsApp:', error);
    res.status(500).json({ ok: false });
  }
};
