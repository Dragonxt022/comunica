import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';
import Secretaria from './Secretaria.ts';

class Solicitacao extends Model {
  public id!: number;
  public titulo!: string;
  public descricao!: string;
  public prioridade!: 'baixa' | 'media' | 'alta';
  public tipo_midia!: string;
  public status!: string;
  public secretaria_id!: number;
  public criado_por!: number;
  public arte_final_url!: string | null;
  public arte_final_nome!: string | null;
  public link_publicacao!: string | null;
  public secretaria?: Secretaria;
  public autor?: User;
}

Solicitacao.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    prioridade: {
      type: DataTypes.ENUM('baixa', 'media', 'alta'),
      defaultValue: 'media',
    },
    tipo_midia: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pendente',
    },
    secretaria_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    criado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    arte_final_url: { type: DataTypes.STRING(500), allowNull: true },
    arte_final_nome: { type: DataTypes.STRING, allowNull: true },
    link_publicacao: { type: DataTypes.STRING(500), allowNull: true },
  },
  {
    sequelize,
    modelName: 'Solicitacao',
    tableName: 'solicitacoes',
  }
);

Solicitacao.belongsTo(Secretaria, { foreignKey: 'secretaria_id', as: 'secretaria' });
Solicitacao.belongsTo(User, { foreignKey: 'criado_por', as: 'autor' });

export default Solicitacao;
