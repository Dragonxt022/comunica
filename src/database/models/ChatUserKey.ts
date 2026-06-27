import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

// Stores each user's ECDH P-256 key pair for E2E encryption of DMs.
// private_key_jwk is stored server-side so the same key pair is available on any device.
class ChatUserKey extends Model {
  public id!: number;
  public user_id!: number;
  public public_key_jwk!: string;
  public private_key_jwk!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
}

ChatUserKey.init({
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id:         { type: DataTypes.INTEGER, allowNull: false, unique: true },
  public_key_jwk:  { type: DataTypes.TEXT, allowNull: false },
  private_key_jwk: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, tableName: 'chat_user_keys', timestamps: true });

export default ChatUserKey;
