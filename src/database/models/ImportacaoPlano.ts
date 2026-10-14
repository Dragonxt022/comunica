import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class ImportacaoPlano extends Model {
  public id!: number;
  public plano_id!: number;
  public criado_por!: number;
  public resumo!: string | null;
  public total_indicadores!: number;
  public total_acoes!: number;
}

ImportacaoPlano.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    plano_id: { type: DataTypes.INTEGER, allowNull: false },
    criado_por: { type: DataTypes.INTEGER, allowNull: false },
    resumo: { type: DataTypes.TEXT, allowNull: true },
    total_indicadores: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_acoes: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: 'ImportacaoPlano', tableName: 'importacoes_plano' }
);

export default ImportacaoPlano;
