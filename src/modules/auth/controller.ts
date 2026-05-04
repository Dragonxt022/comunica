import { Request, Response } from 'express';
import { User, Secretaria } from '../../database/models/index.ts';
import bcrypt from 'bcryptjs';

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
