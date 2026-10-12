import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/**
 * Modelo (template) visual institucional. O layout concreto de cada formato
 * fica nas variantes (`ArteTemplateVariante`); aqui ficam metadados, versão,
 * campos dinâmicos, formatos suportados e regras de validação.
 */
class ArteTemplate extends Model {
  public id!: number;
  public municipio_id!: number | null;
  public nome!: string;
  public slug!: string;
  public descricao!: string | null;
  public categoria!: string;
  public estado!: 'rascunho' | 'publicado' | 'arquivado';
  public versao!: number;
  public paleta_id!: number | null;
  public formatos!: string; // JSON: ['9:16','3:4'] ou []
  public campos!: string; // JSON: campos dinâmicos
  public regras!: string | null; // JSON: regras de validação adicionais
  public carrossel!: boolean;
  public autor_id!: number | null;
  public variantes?: import('./ArteTemplateVariante.ts').default[];
}

ArteTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    municipio_id: { type: DataTypes.INTEGER, allowNull: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    categoria: { type: DataTypes.STRING, defaultValue: 'Institucional' },
    estado: { type: DataTypes.STRING, defaultValue: 'rascunho' },
    versao: { type: DataTypes.INTEGER, defaultValue: 1 },
    paleta_id: { type: DataTypes.INTEGER, allowNull: true },
    formatos: { type: DataTypes.TEXT, defaultValue: '[]' },
    campos: { type: DataTypes.TEXT, defaultValue: '[]' },
    regras: { type: DataTypes.TEXT, allowNull: true },
    carrossel: { type: DataTypes.BOOLEAN, defaultValue: false },
    autor_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'ArteTemplate', tableName: 'arte_templates' }
);

export default ArteTemplate;
