import crypto from 'crypto';

function signJwt(payload, secret) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const s = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}
const token = signJwt(
  { sub: 'e261efef-44d3-4b3d-bd8f-f224e01c94ff', email: 'zrodayrit@gmail.com', name: 'Zorenl Rkyle Dayrit' },
  'generate-a-minimum-64-char-secret-string-for-diagramz-development-mode'
);

async function run() {
  const res = await fetch('http://localhost:4000/api/v1/diagrams/e980370b-fede-4ad8-85cc-cb06c2f12b70', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  console.log('Diagram title:', data.title);
  console.log('appState:', data.canvasData?.appState);
  console.log('element count:', data.canvasData?.elements?.length);
  if (data.canvasData?.elements) {
    const strokes = new Set();
    const bgs = new Set();
    data.canvasData.elements.forEach((e) => {
      strokes.add(e.strokeColor);
      bgs.add(e.backgroundColor);
    });
    console.log('Unique strokes:', Array.from(strokes));
    console.log('Unique backgrounds:', Array.from(bgs));
    console.log('Sample elements:', data.canvasData.elements.slice(0, 5).map(e => ({ type: e.type, strokeColor: e.strokeColor, backgroundColor: e.backgroundColor, text: e.text })));
  }
}
run().catch(console.error);
