import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class ChatConversa extends Model {
  public id!: number;
  public tipo!: 'dm' | 'grupo';
  public nome!: string | null;
  public secretaria_id!: number | null;
  public municipio_id!: number | null;
  public criado_por!: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}

ChatConversa.init({
  id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  tipo:         { type: DataTypes.ENUM('dm', 'grupo'), allowNull: false },
  nome:         { type: DataTypes.STRING(100), allowNull: true },
  secretaria_id:{ type: DataTypes.INTEGER, allowNull: true },
  municipio_id: { type: DataTypes.INTEGER, allowNull: true },
  criado_por:   { type: DataTypes.INTEGER, allowNull: false },
}, { sequelize, tableName: 'chat_conversas', timestamps: true });

export default ChatConversa;
