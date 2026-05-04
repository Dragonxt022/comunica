import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Secretaria extends Model {
  public id!: number;
  public nome!: string;
  public slug!: string;
  public cor!: string;
  public ativo!: boolean;
}

Secretaria.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    cor: {
      type: DataTypes.STRING,
      defaultValue: '#3b82f6',
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Secretaria',
    tableName: 'secretarias',
  }
);

export default Secretaria;
