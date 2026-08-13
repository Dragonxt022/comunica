import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Solicitacao, Secretaria } from '../../database/models/index.ts';
import { getActiveMid, municipioWhere } from '../../lib/municipio-filter.ts';

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

    // Secretarias do dropdown: apenas do município ativo. Filtra a tabela `secretarias`
    // pela própria coluna `municipio_id` — não usar secretariaWhere() aqui, que injeta
    // `secretaria_id` (coluna que não existe em `secretarias`, só em tabelas que
    // referenciam uma secretaria via FK, como solicitações).
    const secWhere: any = municipioWhere(sessionUser, { ativo: true }, activeMid);

    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = 24;

    const [{ count, rows: artes }, secretarias, tiposRows] = await Promise.all([
      Solicitacao.findAndCountAll({
        where,
        include: [{ model: Secretaria, as: 'secretaria' }],
        order: [['updatedAt', 'DESC']],
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      Secretaria.findAll({ where: secWhere, order: [['nome', 'ASC']] }),
      Solicitacao.findAll({ where, attributes: ['tipo_midia'], group: ['tipo_midia'] }),
    ]);

    // Distinct tipos entre todos os registros filtrados (não só a página atual)
    const tiposSet = new Set<string>(tiposRows.map((a: any) => a.tipo_midia).filter(Boolean));
    const tipos = Array.from(tiposSet).sort();

    res.render('biblioteca/index', {
      title: 'Biblioteca de Artes',
      artes,
      secretarias,
      tipos,
      filtros: { secretaria_id: secretaria_id || '', tipo_midia: tipo_midia || '', mes: mes || '' },
      totalGeral: count,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
      total: count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
