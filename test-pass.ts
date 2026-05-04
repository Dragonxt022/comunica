import bcrypt from 'bcryptjs';

async function testPassword() {
  const hash = '$2b$12$47z.MLcI8MjqbpAnwAEmTe0LFBegDY/75Mh0oRbeK.UNdVExNqupy';
  const pass = 'admin123';
  const match = await bcrypt.compare(pass, hash);
  console.log('Password match:', match);
}

testPassword();
