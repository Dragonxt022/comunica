import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/**
 * Paleta de cores semântica reutilizável pelos templates de arte.
 * `cores` é um JSON com as chaves: primary, secondary, accent, background,
 * surface, text, mutedText, border, success, warning, danger.
 */
class ArtePaleta extends Model {
  public id!: number;
  public municipio_id!: number | null;
  public nome!: string;
  public slug!: string;
  public descricao!: string | null;
  public cores!: string; // JSON
  public tematica!: boolean;
  public estado!: 'rascunho' | 'publicado' | 'arquivado';
}

ArtePaleta.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    municipio_id: { type: DataTypes.INTEGER, allowNull: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    cores: { type: DataTypes.TEXT, allowNull: false },
    tematica: { type: DataTypes.BOOLEAN, defaultValue: false },
    estado: { type: DataTypes.STRING, defaultValue: 'publicado' },
  },
  { sequelize, modelName: 'ArtePaleta', tableName: 'arte_paletas' }
);

export default ArtePaleta;
