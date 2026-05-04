import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import bcrypt from 'bcryptjs';
import Secretaria from './Secretaria.ts';

class User extends Model {
  public id!: number;
  public nome!: string;
  public email!: string;
  public senha_hash!: string;
  public role!: 'admin' | 'secom' | 'secretaria' | 'imprensa';
  public ativo!: boolean;
  public ultimo_login!: Date | null;
  public secretaria_id!: number | null;
  public secretaria?: Secretaria;

  public async checkPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.senha_hash);
  }
}

User.init(
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    senha_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'secom', 'secretaria', 'imprensa'),
      allowNull: false,
      defaultValue: 'secretaria',
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    ultimo_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    secretaria_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'secretarias',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);

User.belongsTo(Secretaria, { foreignKey: 'secretaria_id', as: 'secretaria' });

export default User;
