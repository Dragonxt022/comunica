import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import Solicitacao from './Solicitacao.ts';

class SolicitacaoImagem extends Model {
  public id!: number;
  public solicitacao_id!: number;
  public url!: string;
  public nome!: string | null;
  public ordem!: number;
  public createdAt!: Date;
}

SolicitacaoImagem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    solicitacao_id: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    nome: { type: DataTypes.STRING, allowNull: true },
    ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'SolicitacaoImagem',
    tableName: 'solicitacao_imagens',
  }
);

SolicitacaoImagem.belongsTo(Solicitacao, { foreignKey: 'solicitacao_id', as: 'solicitacao' });
Solicitacao.hasMany(SolicitacaoImagem, { foreignKey: 'solicitacao_id', as: 'imagens' });

export default SolicitacaoImagem;
