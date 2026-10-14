import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Municipio extends Model {
  public id!: number;
  public nome!: string;
  public slug!: string;
  public estado!: string;
  public ativo!: boolean;
  public ultimo_resumo_fila_em!: Date | null;
  public logo!: string | null;
  public cabecalho!: string | null;
  public rodape!: string | null;
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
    ultimo_resumo_fila_em: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    logo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    cabecalho: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rodape: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Municipio',
    tableName: 'municipios',
  }
);

export default Municipio;
