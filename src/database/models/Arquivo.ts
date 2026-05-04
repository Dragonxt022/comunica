import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Arquivo extends Model {
  public id!: number;
  public nome_original!: string;
  public nome_sistema!: string;
  public mime_type!: string;
  public tamanho!: number;
  public path!: string;
}

Arquivo.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome_original: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nome_sistema: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tamanho: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Arquivo',
    tableName: 'arquivos',
  }
);

export default Arquivo;
