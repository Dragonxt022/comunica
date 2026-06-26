import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Municipio extends Model {
  public id!: number;
  public nome!: string;
  public slug!: string;
  public estado!: string;
  public ativo!: boolean;
}

Municipio.init(
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
    estado: {
      type: DataTypes.STRING(2),
      allowNull: false,
      defaultValue: 'RO',
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Municipio',
    tableName: 'municipios',
  }
);

export default Municipio;
