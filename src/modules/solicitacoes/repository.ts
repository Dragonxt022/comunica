import { Solicitacao, Secretaria, User } from '../../database/models/index.ts';

class SolicitacaoRepository {
  async findAll(where = {}) {
    return await Solicitacao.findAll({
      where,
      include: [
        { model: Secretaria, as: 'secretaria' },
        { model: User, as: 'autor' }
      ],
      order: [['created_at', 'DESC']]
    });
  }

  async findById(id: number) {
    return await Solicitacao.findByPk(id, {
      include: [
        { model: Secretaria, as: 'secretaria' },
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
}

export default new SolicitacaoRepository();
