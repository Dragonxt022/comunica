import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/**
 * Ativo visual da biblioteca: imagem, ícone, fundo, forma, textura ou
 * componente informativo reutilizável pelos templates.
 */
class ArteAtivo extends Model {
  public id!: number;
  public municipio_id!: number | null;
  public nome!: string;
  public categoria!: string;
  public tipo!: 'imagem' | 'icone' | 'fundo' | 'forma' | 'textura' | 'componente';
  public descricao!: string | null;
  public url!: string | null;
  public mime_type!: string | null;
  public largura!: number | null;
  public altura!: number | null;
  public tags!: string | null;
  public paleta_estilo!: string | null;
  public alt!: string | null;
  public uso_institucional!: boolean;
  public estado!: 'rascunho' | 'publicado' | 'arquivado';
  public autor_id!: number | null;
}

ArteAtivo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    municipio_id: { type: DataTypes.INTEGER, allowNull: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    categoria: { type: DataTypes.STRING, defaultValue: 'Geral' },
    tipo: { type: DataTypes.STRING, defaultValue: 'imagem' },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    url: { type: DataTypes.STRING(500), allowNull: true },
    mime_type: { type: DataTypes.STRING, allowNull: true },
    largura: { type: DataTypes.INTEGER, allowNull: true },
    altura: { type: DataTypes.INTEGER, allowNull: true },
    tags: { type: DataTypes.STRING, allowNull: true },
    paleta_estilo: { type: DataTypes.STRING, allowNull: true },
    alt: { type: DataTypes.STRING, allowNull: true },
    uso_institucional: { type: DataTypes.BOOLEAN, defaultValue: false },
    estado: { type: DataTypes.STRING, defaultValue: 'publicado' },
    autor_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'ArteAtivo', tableName: 'arte_ativos' }
);

export default ArteAtivo;
