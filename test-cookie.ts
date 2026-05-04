async function test() {
  try {
    const res = await fetch('http://localhost:3000/login', {
      headers: {
        'x-forwarded-proto': 'https'
      }
    });
    console.log('Status:', res.status);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    // Also check if Set-Cookie is present
    const setCookie = res.headers.get('set-cookie');
    console.log('Set-Cookie:', setCookie);
  } catch (e) {
    console.error(e);
  }
}

test();
