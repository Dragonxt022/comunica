import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import Evento from './Evento.ts';

class Inscricao extends Model {
  public id!: number;
  public evento_id!: number;
  public numero_inscricao!: string;
  public nome!: string;
  public email!: string;
  public telefone!: string;
  public dados!: string; // JSON with all form answers
  public status!: string; // confirmado | pendente | cancelado
  public ip!: string;
  public municipio_id!: number | null;
  public evento?: Evento;
}

Inscricao.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    evento_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    numero_inscricao: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    telefone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dados: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'confirmado',
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    municipio_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Inscricao',
    tableName: 'inscricoes',
  }
);

Inscricao.belongsTo(Evento, { foreignKey: 'evento_id', as: 'evento' });

export default Inscricao;
