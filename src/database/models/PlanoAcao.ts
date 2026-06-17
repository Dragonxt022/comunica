import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';
import Secretaria from './Secretaria.ts';

class PlanoAcao extends Model {
  public id!: number;
  public titulo!: string;
  public descricao!: string | null;
  public periodo_inicio!: string;
  public periodo_fim!: string;
  public status!: string;
  public secretaria_id!: number;
  public criado_por!: number;
  public secretaria?: Secretaria;
  public autor?: User;
}

PlanoAcao.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    periodo_inicio: { type: DataTypes.DATEONLY, allowNull: false },
    periodo_fim: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'ativo' },
    secretaria_id: { type: DataTypes.INTEGER, allowNull: false },
    criado_por: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'PlanoAcao', tableName: 'planos_acao' }
);

PlanoAcao.belongsTo(Secretaria, { foreignKey: 'secretaria_id', as: 'secretaria' });
PlanoAcao.belongsTo(User, { foreignKey: 'criado_por', as: 'autor' });

export default PlanoAcao;
