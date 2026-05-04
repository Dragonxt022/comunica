import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const supportedDialects = ['mysql', 'mariadb', 'sqlite', 'postgres', 'mssql', 'db2', 'oracle'];
let dialect = process.env.DB_DIALECT as any;

// Fallback if dialect is missing or invalid (like the mysterious "Story")
if (!dialect || !supportedDialects.includes(dialect)) {
  dialect = 'sqlite';
}

let storage = process.env.DB_STORAGE;
if (!storage || storage === 'Story') {
  storage = './database/dev.sqlite';
}

const sequelize = new Sequelize({
  dialect: dialect,
  storage: dialect === 'sqlite' ? storage : undefined,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
  },
});

export default sequelize;
