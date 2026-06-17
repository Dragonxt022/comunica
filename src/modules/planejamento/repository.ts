import { Op } from 'sequelize';
import PlanoAcao from '../../database/models/PlanoAcao.ts';
import AcaoPlanejamento from '../../database/models/AcaoPlanejamento.ts';
import IndicadorMeta from '../../database/models/IndicadorMeta.ts';
import Secretaria from '../../database/models/Secretaria.ts';
import User from '../../database/models/User.ts';
import Evento from '../../database/models/Evento.ts';

export const findAllPlanos = async (where: any = {}) => {
  return PlanoAcao.findAll({
    where,
    include: [
      { model: Secretaria, as: 'secretaria' },
      { model: User, as: 'autor', attributes: ['id', 'nome'] },
      { model: AcaoPlanejamento, as: 'acoes', attributes: ['id', 'status'] },
      { model: IndicadorMeta, as: 'indicadores', attributes: ['id', 'valor_meta', 'valor_atual'] },
    ],
    order: [['periodo_inicio', 'DESC']],
  });
};

export const findPlanoById = async (id: number) => {
  return PlanoAcao.findByPk(id, {
    include: [
      { model: Secretaria, as: 'secretaria' },
      { model: User, as: 'autor', attributes: ['id', 'nome'] },
      {
        model: AcaoPlanejamento,
        as: 'acoes',
        order: [['prazo', 'ASC']],
      },
      { model: IndicadorMeta, as: 'indicadores' },
    ],
  });
};

export const createPlano = async (data: any) => {
  return PlanoAcao.create(data);
};

export const updatePlano = async (id: number, data: any) => {
  return PlanoAcao.update(data, { where: { id } });
};

export const destroyPlano = async (id: number) => {
  await AcaoPlanejamento.destroy({ where: { plano_id: id } });
  await IndicadorMeta.destroy({ where: { plano_id: id } });
  return PlanoAcao.destroy({ where: { id } });
};

export const createAcao = async (data: any) => {
  return AcaoPlanejamento.create(data);
};

export const findAcaoById = async (id: number) => {
  return AcaoPlanejamento.findByPk(id, {
    include: [{ model: PlanoAcao, as: 'plano' }],
  });
};

export const updateAcao = async (id: number, data: any) => {
  return AcaoPlanejamento.update(data, { where: { id } });
};

export const destroyAcao = async (id: number) => {
  return AcaoPlanejamento.destroy({ where: { id } });
};

export const createIndicador = async (data: any) => {
  return IndicadorMeta.create(data);
};

export const findIndicadorById = async (id: number) => {
  return IndicadorMeta.findByPk(id);
};

export const updateIndicador = async (id: number, data: any) => {
  return IndicadorMeta.update(data, { where: { id } });
};

export const destroyIndicador = async (id: number) => {
  return IndicadorMeta.destroy({ where: { id } });
};

export const findAcoesComEvento = async (planoId: number) => {
  return AcaoPlanejamento.findAll({
    where: { plano_id: planoId, evento_id: { [Op.not]: null } },
    include: [{ model: Evento, as: 'evento', attributes: ['id', 'titulo', 'status', 'data_inicio'] }],
  });
};
