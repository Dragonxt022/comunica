import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import PlanoAcao from './PlanoAcao.ts';

class IndicadorMeta extends Model {
  public id!: number;
  public indicador!: string;
  public descricao!: string | null;
  public valor_meta!: number;
  public valor_atual!: number;
  public unidade!: string;
  public plano_id!: number;
  public plano?: PlanoAcao;
}

IndicadorMeta.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    indicador: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    valor_meta: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    valor_atual: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    unidade: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unidades' },
    plano_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'IndicadorMeta', tableName: 'indicadores_meta' }
);

IndicadorMeta.belongsTo(PlanoAcao, { foreignKey: 'plano_id', as: 'plano' });
PlanoAcao.hasMany(IndicadorMeta, { foreignKey: 'plano_id', as: 'indicadores' });

export default IndicadorMeta;
