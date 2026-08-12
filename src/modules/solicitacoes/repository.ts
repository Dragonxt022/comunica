import sequelize from '../../config/database.ts';
import { Solicitacao, Secretaria, User, Municipio } from '../../database/models/index.ts';

class SolicitacaoRepository {
  async findAll(where = {}) {
    return await Solicitacao.findAll({
      where,
      include: [
        { model: Secretaria, as: 'secretaria', include: [{ model: Municipio, as: 'municipio' }] },
        { model: User, as: 'autor' }
      ],
      order: [['ordem', 'ASC'], ['created_at', 'DESC']]
    });
  }

  async findAndCountAll(where: any = {}, limit?: number, offset?: number) {
    return Solicitacao.findAndCountAll({
      where,
      include: [
        { model: Secretaria, as: 'secretaria', include: [{ model: Municipio, as: 'municipio' }] },
        { model: User, as: 'autor' },
      ],
      order: [['ordem', 'ASC'], ['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  async findById(id: number) {
    return await Solicitacao.findByPk(id, {
      include: [
        { model: Secretaria, as: 'secretaria', include: [{ model: Municipio, as: 'municipio' }] },
        { model: User, as: 'autor' }
      ]
    });
  }

  async create(data: any) {
    return await Solicitacao.create(data);
  }

  async update(id: number, data: any) {
    return await Solicitacao.update(data, { where: { id } });
  }

  async bulkUpdateOrdem(ids: number[]) {
    return sequelize.transaction((t) =>
      Promise.all(ids.map((id, idx) => Solicitacao.update({ ordem: idx }, { where: { id }, transaction: t })))
    );
  }
}

export default new SolicitacaoRepository();
