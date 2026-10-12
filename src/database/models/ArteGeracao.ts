import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/**
 * Registro de uma geração de arte. Guarda modelo+versão, dados confirmados,
 * formatos, resultado das validações e vínculo com a solicitação de origem.
 */
class ArteGeracao extends Model {
  public id!: number;
  public municipio_id!: number | null;
  public template_id!: number;
  public template_versao!: number;
  public solicitacao_id!: number | null;
  public usuario_id!: number | null;
  public titulo!: string | null;
  public modalidade!: 'unico' | 'duplo' | 'carrossel';
  public estado!: 'rascunho' | 'gerado' | 'aprovado' | 'arquivado';
  public dados!: string; // JSON: valores dos campos
  public formatos!: string; // JSON
  public ativos!: string | null; // JSON: versões de ativos usadas
  public validacoes!: string | null; // JSON: resultado do validador
  public arquivos?: import('./ArteGeracaoArquivo.ts').default[];
}

ArteGeracao.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    municipio_id: { type: DataTypes.INTEGER, allowNull: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    template_versao: { type: DataTypes.INTEGER, defaultValue: 1 },
    solicitacao_id: { type: DataTypes.INTEGER, allowNull: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true },
    titulo: { type: DataTypes.STRING, allowNull: true },
    modalidade: { type: DataTypes.STRING, defaultValue: 'unico' },
    estado: { type: DataTypes.STRING, defaultValue: 'rascunho' },
    dados: { type: DataTypes.TEXT, defaultValue: '{}' },
    formatos: { type: DataTypes.TEXT, defaultValue: '[]' },
    ativos: { type: DataTypes.TEXT, allowNull: true },
    validacoes: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'ArteGeracao', tableName: 'arte_geracoes' }
);

export default ArteGeracao;
