import { FormularioTemplate } from '../../database/models/index.ts';
import User from '../../database/models/User.ts';

class FormularioTemplateRepository {
  async findAll(where: Record<string, any> = {}) {
    return FormularioTemplate.findAll({
      where,
      include: [{ model: User, as: 'autor', attributes: ['id', 'nome'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  async findById(id: number) {
    return FormularioTemplate.findOne({
      where: { id },
      include: [{ model: User, as: 'autor', attributes: ['id', 'nome'] }],
    });
  }

  async create(data: { nome: string; descricao: string; campos: string; municipio_id?: number | null; criado_por: number }) {
    return FormularioTemplate.create(data as any);
  }

  async update(id: number, data: Partial<{ nome: string; descricao: string; campos: string }>) {
    return FormularioTemplate.update(data as any, { where: { id } });
  }

  async delete(id: number) {
    return FormularioTemplate.destroy({ where: { id } });
  }
}

export default new FormularioTemplateRepository();
