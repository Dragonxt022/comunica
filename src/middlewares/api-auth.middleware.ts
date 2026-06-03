import { Request, Response, NextFunction } from 'express';

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'API não configurada' });
  }

  const header = req.headers['x-api-key'] || req.headers['authorization'];
  const provided = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7)
    : header;

  if (!provided || provided !== apiKey) {
    return res.status(401).json({ error: 'Chave de API inválida ou ausente' });
  }

  next();
};
