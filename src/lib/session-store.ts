import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import sequelize from '../config/database.ts';

const SequelizeStore = connectSessionSequelize(session.Store);

export const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
});
