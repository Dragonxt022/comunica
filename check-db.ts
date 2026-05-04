import { User } from './src/database/models/index.ts';
import sequelize from './src/config/database.ts';

async function checkUsers() {
  try {
    await sequelize.authenticate();
    const users = await User.findAll({ attributes: ['id', 'nome', 'email', 'senha_hash', 'ativo'] });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

checkUsers();
