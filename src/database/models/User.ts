import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';
import bcrypt from 'bcryptjs';
import Secretaria from './Secretaria.ts';
import Municipio from './Municipio.ts';

class User extends Model {
  public id!: number;
  public nome!: string;
  public email!: string;
  public senha_hash!: string;
  public role!: 'super_admin' | 'admin' | 'secom' | 'secretaria' | 'imprensa';
  public ativo!: boolean;
  public ultimo_login!: Date | null;
  public secretaria_id!: number | null;
  public secretaria?: Secretaria;
  public municipio_id!: number | null;
  public municipio?: Municipio;
  public avatar!: string | null;
  public celular!: string | null;
  public whatsapp_numero!: string | null;
  public whatsapp_numero_pendente!: string | null;
  public whatsapp_codigo_verificacao!: string | null;
  public whatsapp_codigo_enviado_em!: Date | null;
  public whatsapp_codigo_expira_em!: Date | null;
  public whatsapp_notificacoes_ativo!: boolean;
  public whatsapp_prompt_snooze_until!: Date | null;

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
      type: DataTypes.ENUM('super_admin', 'admin', 'secom', 'secretaria', 'imprensa'),
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
    municipio_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'municipios',
        key: 'id',
      },
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    celular: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    whatsapp_numero: { type: DataTypes.STRING, allowNull: true },
    whatsapp_numero_pendente: { type: DataTypes.STRING, allowNull: true },
    whatsapp_codigo_verificacao: { type: DataTypes.STRING(6), allowNull: true },
    whatsapp_codigo_enviado_em: { type: DataTypes.DATE, allowNull: true },
    whatsapp_codigo_expira_em: { type: DataTypes.DATE, allowNull: true },
    whatsapp_notificacoes_ativo: { type: DataTypes.BOOLEAN, defaultValue: false },
    whatsapp_prompt_snooze_until: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);

User.belongsTo(Secretaria, { foreignKey: 'secretaria_id', as: 'secretaria' });

export default User;
