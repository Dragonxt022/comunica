import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Release extends Model {
  public id!: number;
  public titulo!: string;
  public subtitulo!: string;
  public conteudo!: string;
  public publicado!: boolean;
  public publicado_em!: Date | null;
}

Release.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subtitulo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    conteudo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    publicado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    publicado_em: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Release',
    tableName: 'releases',
  }
);

export default Release;
