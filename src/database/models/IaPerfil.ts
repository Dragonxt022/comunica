import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class IaPerfil extends Model {
  public id!: number;
  public system_prompt!: string;
  public ativo!: boolean;
  public modelo!: string;
}

IaPerfil.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    system_prompt: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
    modelo: { type: DataTypes.STRING, allowNull: false, defaultValue: 'gemma3:1b' },
  },
  { sequelize, modelName: 'IaPerfil', tableName: 'ia_perfis' }
);

export default IaPerfil;
