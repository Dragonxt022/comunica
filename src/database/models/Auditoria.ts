import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';

class Auditoria extends Model {
  public id!: number;
  public user_id!: number | null;
  public acao!: string;
  public entidade!: string;
  public entidade_id!: number | null;
  public ip!: string;
  public user_agent!: string;
}

Auditoria.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    acao: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entidade: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entidade_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Auditoria',
    tableName: 'auditoria',
  }
);

Auditoria.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });

export default Auditoria;
