import { Request, Response } from 'express';
import { User, Secretaria } from '../../database/models/index.ts';
import bcrypt from 'bcryptjs';

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
    const { nome, email, senha_atual, nova_senha } = req.body;
    const usuario = await User.findByPk(sessionUser.id, {
      include: [{ model: Secretaria, as: 'secretaria' }],
    });
    if (!usuario) return res.redirect('/perfil');

    if (nova_senha && nova_senha.trim()) {
      if (!senha_atual) {
        return res.render('perfil', { title: 'Meu Perfil', usuario, success: false, error: 'Informe a senha atual para alterá-la.' });
      }
      const ok = await usuario.checkPassword(senha_atual);
      if (!ok) {
        return res.render('perfil', { title: 'Meu Perfil', usuario, success: false, error: 'Senha atual incorreta.' });
      }
      await usuario.update({ nome, email, senha_hash: await bcrypt.hash(nova_senha, 12) });
    } else {
      await usuario.update({ nome, email });
    }

    sessionUser.nome = nome;
    sessionUser.email = email;

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
      include: [{ model: Secretaria, as: 'secretaria' }]
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
    };

    console.log('Session user set:', (req as any).session.user);

    (req as any).session.save((err: any) => {
      if (err) {
        console.error('Session save error:', err);
        return res.render('auth/login', { 
          title: 'Login', 
          layout: 'layouts/blank', 
          error: 'Erro ao iniciar sessão.' 
        });
      }
      console.log('Session saved successfully, redirecting to /');
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
