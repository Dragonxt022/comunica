import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/** Estilo tipográfico reutilizável (título, subtítulo, corpo, rodapé...). */
class ArteEstilo extends Model {
  public id!: number;
  public municipio_id!: number | null;
  public nome!: string;
  public familia!: string;
  public peso!: number;
  public tamanho!: number;
  public tamanho_min!: number;
  public altura_linha!: number;
  public espacamento_letras!: number;
  public alinhamento!: 'left' | 'center' | 'right';
  public cor!: string; // cor semântica ou hex
  public limite_linhas!: number | null;
  public margem!: number;
  public overflow!: 'diminuir' | 'cortar' | 'avisar';
  public estado!: 'rascunho' | 'publicado' | 'arquivado';
}

ArteEstilo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    municipio_id: { type: DataTypes.INTEGER, allowNull: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    familia: { type: DataTypes.STRING, defaultValue: 'Inter, system-ui, sans-serif' },
    peso: { type: DataTypes.INTEGER, defaultValue: 700 },
    tamanho: { type: DataTypes.INTEGER, defaultValue: 64 },
    tamanho_min: { type: DataTypes.INTEGER, defaultValue: 28 },
    altura_linha: { type: DataTypes.FLOAT, defaultValue: 1.15 },
    espacamento_letras: { type: DataTypes.FLOAT, defaultValue: 0 },
    alinhamento: { type: DataTypes.STRING, defaultValue: 'left' },
    cor: { type: DataTypes.STRING, defaultValue: 'text' },
    limite_linhas: { type: DataTypes.INTEGER, allowNull: true },
    margem: { type: DataTypes.INTEGER, defaultValue: 0 },
    overflow: { type: DataTypes.STRING, defaultValue: 'avisar' },
    estado: { type: DataTypes.STRING, defaultValue: 'publicado' },
  },
  { sequelize, modelName: 'ArteEstilo', tableName: 'arte_estilos' }
);

export default ArteEstilo;
