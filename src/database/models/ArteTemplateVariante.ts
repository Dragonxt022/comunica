import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/**
 * Variante de um template: uma composição concreta para um formato/papel
 * (9:16, 3:4, capa/interna/final de carrossel). O layout fica em `config` (JSON).
 */
class ArteTemplateVariante extends Model {
  public id!: number;
  public template_id!: number;
  public chave!: string;
  public papel!: 'principal' | 'capa' | 'interna' | 'final';
  public nome!: string;
  public largura!: number;
  public altura!: number;
  public config!: string; // JSON: { elementos: Elemento[] }
  public template?: import('./ArteTemplate.ts').default;
}

ArteTemplateVariante.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    chave: { type: DataTypes.STRING, allowNull: false },
    papel: { type: DataTypes.STRING, defaultValue: 'principal' },
    nome: { type: DataTypes.STRING, defaultValue: 'Principal' },
    largura: { type: DataTypes.INTEGER, allowNull: false },
    altura: { type: DataTypes.INTEGER, allowNull: false },
    config: { type: DataTypes.TEXT, defaultValue: '{"elementos":[]}' },
  },
  { sequelize, modelName: 'ArteTemplateVariante', tableName: 'arte_template_variantes' }
);

export default ArteTemplateVariante;
