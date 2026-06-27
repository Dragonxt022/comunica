import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class ChatParticipante extends Model {
  public id!: number;
  public conversa_id!: number;
  public user_id!: number;
  public ultimo_lido_at!: Date | null;
  public ativo!: boolean;
}

ChatParticipante.init({
  id:            { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  conversa_id:   { type: DataTypes.INTEGER, allowNull: false },
  user_id:       { type: DataTypes.INTEGER, allowNull: false },
  ultimo_lido_at:{ type: DataTypes.DATE, allowNull: true },
  ativo:         { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, tableName: 'chat_participantes', timestamps: false });

export default ChatParticipante;
