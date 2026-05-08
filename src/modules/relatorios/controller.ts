import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Release, Solicitacao, Secretaria } from '../../database/models/index.ts';

export const index = async (req: Request, res: Response) => {
  try {
    const secretarias = await Secretaria.findAll({ where: { ativo: true }, order: [['nome', 'ASC']] });
    const tiposMidia = ['Fotografia', 'Vídeo', 'Cobertura jornalística', 'Nota à imprensa', 'Release', 'Arte gráfica', 'Transmissão ao vivo', 'Post para Redes Sociais', 'Outros'];
    res.render('relatorios/index', { title: 'Relatórios', secretarias, tiposMidia });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

export const gerar = async (req: Request, res: Response) => {
  try {
    const { data_inicio, data_fim, incluir_releases, incluir_solicitacoes, tipos_midia, secretaria_id } = req.body;

    const dtInicio = new Date(data_inicio);
    dtInicio.setHours(0, 0, 0, 0);
    const dtFim = new Date(data_fim);
    dtFim.setHours(23, 59, 59, 999);

    let releases: any[] = [];
    let solicitacoes: any[] = [];

    if (incluir_releases) {
      const where: any = {
        publicado: true,
        publicado_em: { [Op.between]: [dtInicio, dtFim] },
      };
      if (secretaria_id) where.secretaria_id = secretaria_id;
      releases = await Release.findAll({
        where,
        include: [{ model: Secretaria, as: 'secretaria' }],
        order: [['publicado_em', 'DESC']],
      });
    }

    if (incluir_solicitacoes) {
      const tipos = Array.isArray(tipos_midia) ? tipos_midia : (tipos_midia ? [tipos_midia] : []);
      const where: any = {
        createdAt: { [Op.between]: [dtInicio, dtFim] },
      };
      if (tipos.length > 0) where.tipo_midia = { [Op.in]: tipos };
      if (secretaria_id) where.secretaria_id = secretaria_id;
      solicitacoes = await Solicitacao.findAll({
        where,
        include: [{ model: Secretaria, as: 'secretaria' }],
        order: [['createdAt', 'DESC']],
      });
    }

    const periodoLabel = `${new Date(data_inicio).toLocaleDateString('pt-BR')} a ${new Date(data_fim).toLocaleDateString('pt-BR')}`;

    res.render('relatorios/gerar', {
      title: 'Relatório',
      layout: 'layouts/print',
      releases,
      solicitacoes,
      periodoLabel,
      geradoEm: new Date().toLocaleString('pt-BR'),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};
