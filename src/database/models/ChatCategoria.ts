import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class ChatCategoria extends Model {
  public id!: number;
  public user_id!: number;
  public nome!: string;
  public emoji!: string;
  public cor!: string;
  public ordem!: number;
}

ChatCategoria.init({
  id:     { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id:{ type: DataTypes.INTEGER, allowNull: false },
  nome:   { type: DataTypes.STRING(60), allowNull: false },
  emoji:  { type: DataTypes.STRING(8), defaultValue: '📁' },
  cor:    { type: DataTypes.STRING(20), defaultValue: '#6366f1' },
  ordem:  { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'chat_categorias', timestamps: true, updatedAt: false });

export default ChatCategoria;
