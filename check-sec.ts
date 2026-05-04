import { Secretaria } from './src/database/models/index.ts';
import sequelize from './src/config/database.ts';

async function checkSec() {
  try {
    await sequelize.authenticate();
    const data = await Secretaria.findAll();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

checkSec();
