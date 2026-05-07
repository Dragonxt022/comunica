import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import Secretaria from './Secretaria.ts';

class Release extends Model {
  public id!: number;
  public titulo!: string;
  public subtitulo!: string;
  public conteudo!: string;
  public imagem_capa!: string | null;
  public publicado!: boolean;
  public publicado_em!: Date | null;
  public agendado_para!: Date | null;
  public secretaria_id!: number | null;
  public secretaria?: Secretaria;
}

Release.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo: { type: DataTypes.STRING, allowNull: false },
    subtitulo: { type: DataTypes.STRING, allowNull: true },
    conteudo: { type: DataTypes.TEXT, allowNull: false },
    imagem_capa: { type: DataTypes.STRING, allowNull: true },
    publicado: { type: DataTypes.BOOLEAN, defaultValue: false },
    publicado_em: { type: DataTypes.DATE, allowNull: true },
    agendado_para: { type: DataTypes.DATE, allowNull: true },
    secretaria_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'Release', tableName: 'releases' }
);

Release.belongsTo(Secretaria, { foreignKey: 'secretaria_id', as: 'secretaria' });

export default Release;
