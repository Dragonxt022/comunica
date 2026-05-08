import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class Configuracao extends Model {
  public id!: number;
  public titulo_site!: string;
  public subtitulo_site!: string;
  public descricao_site!: string;
  public email_contato!: string;
  public telefone_contato!: string;
  public instagram!: string;
  public site_oficial!: string;
  public status_eventos!: string | null;
  public metas_midia!: string | null;
}

Configuracao.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    titulo_site: { type: DataTypes.STRING, defaultValue: 'Prefeitura Municipal' },
    subtitulo_site: { type: DataTypes.STRING, defaultValue: '' },
    descricao_site: { type: DataTypes.TEXT, defaultValue: '' },
    email_contato: { type: DataTypes.STRING, defaultValue: '' },
    telefone_contato: { type: DataTypes.STRING, defaultValue: '' },
    instagram: { type: DataTypes.STRING, defaultValue: '' },
    site_oficial: { type: DataTypes.STRING, defaultValue: '' },
    status_eventos: { type: DataTypes.TEXT, allowNull: true },
    metas_midia: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'Configuracao', tableName: 'configuracoes' }
);

export default Configuracao;
