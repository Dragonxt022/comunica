import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';

class OliviaMensagem extends Model {
  public id!: number;
  public user_id!: number;
  public role!: 'user' | 'assistant';
  public texto!: string;
  public createdAt!: Date;
}

OliviaMensagem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    texto: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'OliviaMensagem',
    tableName: 'olivia_mensagens',
    updatedAt: false,
  }
);

OliviaMensagem.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });

export default OliviaMensagem;
