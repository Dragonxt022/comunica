import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Solicitacao, Secretaria } from '../../database/models/index.ts';
import { getActiveMid, secretariaWhere } from '../../lib/municipio-filter.ts';

export const index = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as any).session.user;
    const activeMid = getActiveMid(req);
    const { secretaria_id, tipo_midia, mes } = req.query;

    const where: any = {
      arte_final_url: { [Op.ne]: null },
      status: { [Op.in]: ['finalizado', 'concluído'] },
    };

    // Isolamento por município: secretaria vê só sua secretaria; demais veem só seu município
    if (sessionUser.role === 'secretaria') {
      where.secretaria_id = sessionUser.secretaria_id;
      where.municipio_id = sessionUser.municipio_id;
    } else if (sessionUser.role === 'super_admin') {
      if (activeMid) where.municipio_id = activeMid;
      if (secretaria_id) where.secretaria_id = secretaria_id;
    } else {
      // admin / secom: apenas seu município
      where.municipio_id = sessionUser.municipio_id;
      if (secretaria_id) where.secretaria_id = secretaria_id;
    }

    if (tipo_midia) where.tipo_midia = tipo_midia;

    if (mes && typeof mes === 'string' && /^\d{4}-\d{2}$/.test(mes)) {
      const [ano, m] = mes.split('-').map(Number);
      const inicio = new Date(ano, m - 1, 1);
      const fim = new Date(ano, m, 0, 23, 59, 59, 999);
      where.updatedAt = { [Op.between]: [inicio, fim] };
    }

    // Secretarias do dropdown: apenas do município ativo
    const secWhere: any = secretariaWhere(sessionUser, { ativo: true }, activeMid);

    const [artes, secretarias] = await Promise.all([
      Solicitacao.findAll({
        where,
        include: [{ model: Secretaria, as: 'secretaria' }],
        order: [['updatedAt', 'DESC']],
        limit: 200,
      }),
      Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] }),
    ]);

    // Distinct tipos from current filtered artes
    const tiposSet = new Set<string>(artes.map((a: any) => a.tipo_midia).filter(Boolean));
    const tipos = Array.from(tiposSet).sort();

    res.render('biblioteca/index', {
      title: 'Biblioteca de Artes',
      artes,
      secretarias,
      tipos,
      filtros: { secretaria_id: secretaria_id || '', tipo_midia: tipo_midia || '', mes: mes || '' },
      totalGeral: artes.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
