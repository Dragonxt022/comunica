import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import PlanoAcao from './PlanoAcao.ts';
import Evento from './Evento.ts';

class AcaoPlanejamento extends Model {
  public id!: number;
  public titulo!: string;
  public descricao!: string | null;
  public objetivo!: string | null;
  public responsavel_nome!: string | null;
  public prazo!: string | null;
  public prioridade!: string;
  public status!: string;
  public plano_id!: number;
  public evento_id!: number | null;
  public plano?: PlanoAcao;
}

AcaoPlanejamento.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    objetivo: { type: DataTypes.TEXT, allowNull: true },
    responsavel_nome: { type: DataTypes.STRING, allowNull: true },
    prazo: { type: DataTypes.DATEONLY, allowNull: true },
    prioridade: { type: DataTypes.STRING, defaultValue: 'media' },
    status: { type: DataTypes.STRING, defaultValue: 'nao_iniciado' },
    plano_id: { type: DataTypes.INTEGER, allowNull: false },
    evento_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'AcaoPlanejamento', tableName: 'acoes_planejamento' }
);

AcaoPlanejamento.belongsTo(PlanoAcao, { foreignKey: 'plano_id', as: 'plano' });
PlanoAcao.hasMany(AcaoPlanejamento, { foreignKey: 'plano_id', as: 'acoes' });
AcaoPlanejamento.belongsTo(Evento, { foreignKey: 'evento_id', as: 'evento' });

export default AcaoPlanejamento;
