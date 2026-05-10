import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Notificacao extends Model {
  public id!: number;
  public user_id!: number;
  public titulo!: string;
  public corpo!: string | null;
  public url!: string | null;
  public tipo!: string | null;
  public lida!: boolean;
}

Notificacao.init(
  {
    id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id:  { type: DataTypes.INTEGER, allowNull: false },
    titulo:   { type: DataTypes.STRING(255), allowNull: false },
    corpo:    { type: DataTypes.TEXT, allowNull: true },
    url:      { type: DataTypes.STRING(500), allowNull: true },
    tipo:     { type: DataTypes.STRING(60), allowNull: true },
    lida:     { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  },
  { sequelize, modelName: 'Notificacao', tableName: 'notificacoes' }
);

export default Notificacao;
