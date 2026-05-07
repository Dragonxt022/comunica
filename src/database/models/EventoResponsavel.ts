import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.ts';

class EventoResponsavel extends Model {
  public evento_id!: number;
  public user_id!: number;
}

EventoResponsavel.init(
  {
    evento_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id:   { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: 'EventoResponsavel',
    tableName: 'evento_responsaveis',
    timestamps: false,
  }
);

export default EventoResponsavel;
