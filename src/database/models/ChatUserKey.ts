import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

// Stores each user's ECDH P-256 public key for E2E encryption of DMs
class ChatUserKey extends Model {
  public id!: number;
  public user_id!: number;
  public public_key_jwk!: string; // JSON-stringified JWK of the ECDH public key
  public createdAt!: Date;
  public updatedAt!: Date;
}

ChatUserKey.init({
  id:             { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id:        { type: DataTypes.INTEGER, allowNull: false, unique: true },
  public_key_jwk: { type: DataTypes.TEXT, allowNull: false },
}, { sequelize, tableName: 'chat_user_keys', timestamps: true });

export default ChatUserKey;
