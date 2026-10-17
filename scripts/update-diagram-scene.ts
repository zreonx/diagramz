import { Pool } from '../apps/api/node_modules/pg';
import { generateLandingPagePaymentScene } from '../apps/web/src/lib/starter-templates-scenes';

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5433/diagramz?sslmode=disable'
});

async function main() {
  const elements = generateLandingPagePaymentScene(true);
  console.log(`Generated ${elements.length} modern elements.`);

  const canvasData = {
    elements,
    appState: {
      theme: 'dark',
      viewBackgroundColor: '#09090b',
      currentItemFontFamily: 2,
      currentItemFontSize: 14,
      currentItemStrokeWidth: 1,
      currentItemEndArrowhead: 'triangle'
    },
    files: {}
  };

  const targetId = '1d31b002-4fe4-48bd-a3ad-717ba5a79f65';
  await pool.query(
    'UPDATE diagram_canvases SET canvas_data = $1, updated_at = NOW() WHERE diagram_id = $2;',
    [JSON.stringify(canvasData), targetId]
  );
  console.log(`Updated diagram_canvases for ${targetId}!`);

  pool.end();
}

main().catch(console.error);
