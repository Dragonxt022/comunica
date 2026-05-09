import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class PushSubscription extends Model {
  public id!: number;
  public user_id!: number;
  public endpoint!: string;
  public p256dh!: string;
  public auth!: string;
}

PushSubscription.init(
  {
    id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id:  { type: DataTypes.INTEGER, allowNull: false },
    endpoint: { type: DataTypes.TEXT,    allowNull: false },
    p256dh:   { type: DataTypes.TEXT,    allowNull: false },
    auth:     { type: DataTypes.TEXT,    allowNull: false },
  },
  { sequelize, modelName: 'PushSubscription', tableName: 'push_subscriptions' }
);

export default PushSubscription;
