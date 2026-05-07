import { Evento, Secretaria, User } from '../../database/models/index.ts';

class EventoRepository {
  async findAll(where = {}) {
    return await Evento.findAll({
      where,
      include: [
        { model: Secretaria, as: 'secretaria' },
        { model: User, as: 'autor' },
        { model: User, as: 'responsaveis', through: { attributes: [] } },
      ],
      order: [['data_inicio', 'ASC']]
    });
  }

  async findById(id: number) {
    return await Evento.findByPk(id, {
      include: [
        { model: Secretaria, as: 'secretaria' },
        { model: User, as: 'autor' },
        { model: User, as: 'responsaveis', through: { attributes: [] } },
      ]
    });
  }

  async create(data: any) {
    return await Evento.create(data);
  }

  async update(id: number, data: any) {
    return await Evento.update(data, { where: { id } });
  }

  async delete(id: number) {
    return await Evento.destroy({ where: { id } });
  }
}

export default new EventoRepository();
