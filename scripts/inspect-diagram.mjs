import postgres from 'postgres';
const sql = postgres('postgresql://postgres:postgres@localhost:5433/diagramz?sslmode=disable');

async function run() {
  const [d] = await sql`SELECT id, title, "canvasData", "mermaidCode" FROM diagrams WHERE id = 'e980370b-fede-4ad8-85cc-cb06c2f12b70'`;
  console.log('Title:', d.title);
  console.log('canvasData keys:', typeof d.canvasData === 'object' ? Object.keys(d.canvasData) : d.canvasData);
  if (d.canvasData?.appState) console.log('appState:', d.canvasData.appState);
  if (d.canvasData?.elements) {
    console.log('Element count:', d.canvasData.elements.length);
    console.log('First 3 elements:', JSON.stringify(d.canvasData.elements.slice(0, 3), null, 2));
  }
  await sql.end();
}
run().catch(console.error);
