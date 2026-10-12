import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

/** Arquivo final (PNG) de uma geração, por página/formato/papel. */
class ArteGeracaoArquivo extends Model {
  public id!: number;
  public geracao_id!: number;
  public papel!: string;
  public formato!: string;
  public largura!: number;
  public altura!: number;
  public url!: string;
  public previa!: string | null;
  public pagina!: number;
  public geracao?: import('./ArteGeracao.ts').default;
}

ArteGeracaoArquivo.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    geracao_id: { type: DataTypes.INTEGER, allowNull: false },
    papel: { type: DataTypes.STRING, defaultValue: 'principal' },
    formato: { type: DataTypes.STRING, allowNull: false },
    largura: { type: DataTypes.INTEGER, allowNull: false },
    altura: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    previa: { type: DataTypes.STRING(500), allowNull: true },
    pagina: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  { sequelize, modelName: 'ArteGeracaoArquivo', tableName: 'arte_geracao_arquivos' }
);

export default ArteGeracaoArquivo;
