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
  public aceita_inscricoes!: boolean;
  public formulario_template_id!: number | null;
  public max_inscricoes!: number | null;
  public inscricoes_abertas!: boolean;
  public token_inscricao!: string;
  public imagem_capa!: string | null;
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
    aceita_inscricoes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    formulario_template_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    max_inscricoes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    inscricoes_abertas: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    token_inscricao: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    imagem_capa: {
      type: DataTypes.STRING(500),
      allowNull: true,
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
