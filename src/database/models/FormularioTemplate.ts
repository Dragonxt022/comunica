import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import User from './User.ts';

class FormularioTemplate extends Model {
  public id!: number;
  public nome!: string;
  public descricao!: string;
  public campos!: string; // JSON array of field definitions
  public criado_por!: number;
  public autor?: User;
}

FormularioTemplate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    campos: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
    },
    criado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'FormularioTemplate',
    tableName: 'formulario_templates',
  }
);

FormularioTemplate.belongsTo(User, { foreignKey: 'criado_por', as: 'autor' });

export default FormularioTemplate;
