import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';

class SolicitacaoComentario extends Model {
  public id!: number;
  public solicitacao_id!: number;
  public autor_id!: number;
  public tipo!: 'comentario' | 'evento' | 'anexo' | 'aprovacao' | 'revisao';
  public texto!: string | null;
  public arquivo_url!: string | null;
  public arquivo_nome!: string | null;
  public createdAt!: Date;
  public autor?: User;
}

SolicitacaoComentario.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    solicitacao_id: { type: DataTypes.INTEGER, allowNull: false },
    autor_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo: { type: DataTypes.STRING, allowNull: false, defaultValue: 'comentario' },
    texto: { type: DataTypes.TEXT, allowNull: true },
    arquivo_url: { type: DataTypes.STRING, allowNull: true },
    arquivo_nome: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'SolicitacaoComentario',
    tableName: 'solicitacao_comentarios',
  }
);

SolicitacaoComentario.belongsTo(User, { foreignKey: 'autor_id', as: 'autor' });

export default SolicitacaoComentario;
