import { Op, literal } from 'sequelize';
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

  async findByEmailAndEvento(email: string, eventoId: number) {
    return Inscricao.findOne({
      where: {
        evento_id: eventoId,
        email: email.toLowerCase(),
        status: { [Op.ne]: 'cancelado' },
      },
    });
  }

  async findDuplicates(eventoId: number) {
    // Returns all inscription records that share the same email for the same event,
    // keeping only the first (lowest id) — the rest are duplicates to remove.
    const all = await Inscricao.findAll({
      where: { evento_id: eventoId },
      order: [['id', 'ASC']],
    }) as any[];

    const seen = new Map<string, number>();
    const toDelete: any[] = [];

    for (const ins of all) {
      const key = ins.email.toLowerCase();
      if (seen.has(key)) {
        toDelete.push(ins);
      } else {
        seen.set(key, ins.id);
      }
    }
    return toDelete;
  }

  async deleteById(id: number) {
    return Inscricao.destroy({ where: { id } });
  }
}

export default new InscricaoRepository();
