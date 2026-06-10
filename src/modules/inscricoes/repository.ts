import { Op } from 'sequelize';
import { Inscricao, Evento } from '../../database/models/index.ts';
import Secretaria from '../../database/models/Secretaria.ts';

class InscricaoRepository {
  async findByEvento(eventoId: number, where: any = {}, limit?: number, offset?: number) {
    return Inscricao.findAndCountAll({
      where: { evento_id: eventoId, ...where },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  async findById(id: number) {
    return Inscricao.findOne({
      where: { id },
      include: [{ model: Evento, as: 'evento', include: [{ model: Secretaria, as: 'secretaria' }] }],
    });
  }

  async findByNumero(numero: string) {
    return Inscricao.findOne({
      where: { numero_inscricao: numero },
      include: [{ model: Evento, as: 'evento', include: [{ model: Secretaria, as: 'secretaria' }] }],
    });
  }

  async countByEvento(eventoId: number) {
    return Inscricao.count({ where: { evento_id: eventoId, status: { [Op.ne]: 'cancelado' } } });
  }

  async create(data: {
    evento_id: number;
    numero_inscricao: string;
    nome: string;
    email: string;
    telefone: string;
    dados: string;
    status: string;
    ip: string;
  }) {
    return Inscricao.create(data as any);
  }

  async updateStatus(id: number, status: string) {
    return Inscricao.update({ status } as any, { where: { id } });
  }

  async generateNumero(eventoId: number): Promise<string> {
    const year = new Date().getFullYear();
    const count = await Inscricao.count({ where: { evento_id: eventoId } });
    return `INS-${year}-${String(eventoId).padStart(4, '0')}-${String(count + 1).padStart(4, '0')}`;
  }
}

export default new InscricaoRepository();
