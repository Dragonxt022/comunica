import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';
import Secretaria from './Secretaria.ts';

class Evento extends Model {
  public id!: number;
  public titulo!: string;
  public descricao!: string;
  public local!: string;
  public data_inicio!: Date;
  public data_fim!: Date;
  public tipo!: string;
  public status!: string;
  public secretaria_id!: number;
  public criado_por!: number;
  public arquivado!: boolean;
  public secretaria?: Secretaria;
  public autor?: User;
}

Evento.init(
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
    local: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    data_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    data_fim: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'em_planejamento',
    },
    secretaria_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    criado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    arquivado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'Evento',
    tableName: 'eventos',
  }
);

Evento.belongsTo(Secretaria, { foreignKey: 'secretaria_id', as: 'secretaria' });
Evento.belongsTo(User, { foreignKey: 'criado_por', as: 'autor' });

export default Evento;
