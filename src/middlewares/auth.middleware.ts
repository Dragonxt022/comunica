import { Request, Response, NextFunction } from 'express';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).session.user) {
    return next();
  }
  res.redirect('/login');
};

export const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).session.user;
    if (user && roles.includes(user.role)) {
      return next();
    }
    res.status(403).render('errors/403', { title: 'Acesso Negado', layout: 'layouts/main' });
  };
};

export const isActive = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).session.user;
  // In a real app, we might want to check the DB here for each request or cache it
  if (user) {
    return next();
  }
  res.redirect('/login');
};
