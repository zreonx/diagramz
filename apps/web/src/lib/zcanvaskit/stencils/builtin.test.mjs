import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerTsResolver } from '../../../../test/register-ts-resolver.mjs';

registerTsResolver();

const { ARCHITECTURE_STENCILS, ARCHITECTURE_STENCIL_META } = await import(
  './architecture.ts'
);
const { TECH_ICON_STENCILS } = await import('./tech-icons.ts');
const { BUILTIN_STENCILS, BUILTIN_STENCIL_REGISTRY } = await import('./builtin.ts');
const { stencilViewBox } = await import('./registry.ts');
const { measureArtwork } = await import('./artwork-bounds.ts');

/** Both themes, because a stencil that only draws in one is a bug. */
const THEMES = [
  { name: 'dark', isDark: true },
  { name: 'light', isDark: false },
];

test('the catalogue and the artwork agree on how many stencils there are', () => {
  assert.equal(ARCHITECTURE_STENCIL_META.length, 52);
  assert.equal(ARCHITECTURE_STENCILS.length, 52);
  assert.equal(
    ARCHITECTURE_STENCILS.length,
    ARCHITECTURE_STENCIL_META.length,
    'every catalogue entry must have artwork, and vice versa'
  );
});

test('every catalogue entry names its own artwork, in order', () => {
  assert.deepEqual(
    ARCHITECTURE_STENCILS.map((s) => s.id),
    ARCHITECTURE_STENCIL_META.map((m) => m.id),
    'the panel lists the catalogue, so an id present in only one of the two is a blank tile'
  );
});

test('the catalogue carries the library metadata the panel renders', () => {
  for (const meta of ARCHITECTURE_STENCIL_META) {
    assert.ok(meta.title.length > 0, `${meta.id} has no title`);
    assert.ok(meta.category.length > 0, `${meta.id} has no category`);
    assert.ok(meta.width > 0 && meta.height > 0, `${meta.id} has a degenerate size`);
    assert.match(meta.accentColor, /^#[0-9a-fA-F]{6}$/, `${meta.id} has a non-hex chip colour`);
  }
});

test('every architecture stencil draws real artwork in both themes', () => {
  for (const stencil of ARCHITECTURE_STENCILS) {
    for (const theme of THEMES) {
      const markup = stencil.render({
        width: stencil.defaultWidth,
        height: stencil.defaultHeight,
        isDark: theme.isDark,
      });

      assert.ok(
        markup.trim().length > 0,
        `${stencil.id} draws nothing in the ${theme.name} theme`
      );
      assert.ok(
        !markup.includes('undefined'),
        `${stencil.id} interpolated an undefined value in the ${theme.name} theme`
      );
      assert.ok(
        !/\bNaN\b/.test(markup),
        `${stencil.id} wrote NaN into its markup in the ${theme.name} theme`
      );
      assert.ok(
        !markup.includes('${'),
        `${stencil.id} left an uninterpolated template hole in the ${theme.name} theme`
      );
    }
  }
});

test('no architecture stencil silently falls back to the placeholder', () => {
  // The fallback is a plain frame, drawn when a catalogue id has no renderer.
  // If one ever loses its artwork the library would quietly show that frame,
  // and every other check here would still pass — the placeholder is valid,
  // non-empty, NaN-free markup. So it is matched exactly rather than by shape:
  // a real stencil may legitimately begin with a rectangle, but none of them
  // renders this precise string.
  const placeholder = (isDark) =>
    `<g><rect x="20" y="20" width="60" height="60" rx="8" fill="none" stroke="${
      isDark ? '#f4f4f5' : '#18181b'
    }" stroke-width="2" /></g>`;

  for (const stencil of ARCHITECTURE_STENCILS) {
    for (const theme of THEMES) {
      const markup = stencil.render({
        width: stencil.defaultWidth,
        height: stencil.defaultHeight,
        isDark: theme.isDark,
      });
      assert.notEqual(
        markup,
        placeholder(theme.isDark),
        `${stencil.id} has no artwork of its own and is drawing the placeholder`
      );
    }
  }
});

test('no two architecture stencils draw the same picture', () => {
  // The old JSX and markup copies had already drifted; a copy-paste that leaves
  // two ids sharing one drawing is the same class of bug.
  const seen = new Map();

  for (const stencil of ARCHITECTURE_STENCILS) {
    const markup = stencil.render({
      width: stencil.defaultWidth,
      height: stencil.defaultHeight,
      isDark: true,
    });
    const previous = seen.get(markup);
    assert.equal(
      previous,
      undefined,
      `${stencil.id} draws exactly what ${previous} draws`
    );
    seen.set(markup, stencil.id);
  }
});

test('an architecture stencil is a pure function of its context', () => {
  for (const stencil of ARCHITECTURE_STENCILS) {
    const context = {
      width: stencil.defaultWidth,
      height: stencil.defaultHeight,
      isDark: true,
    };
    assert.equal(
      stencil.render(context),
      stencil.render(context),
      `${stencil.id} renders differently on a second call`
    );
  }
});

test('the theme actually reaches the artwork', () => {
  // A renderer that ignores `isDark` would draw dark ink on the dark plate.
  const insensitive = ARCHITECTURE_STENCILS.filter((stencil) => {
    const context = { width: stencil.defaultWidth, height: stencil.defaultHeight };
    return stencil.render({ ...context, isDark: true }) === stencil.render({ ...context, isDark: false });
  });

  assert.deepEqual(insensitive.map((s) => s.id), [], 'these stencils ignore the theme');
});

test('the authored width and height do not change what a stencil draws', () => {
  // Architecture artwork is authored in a 100x100 square and scaled by the
  // consumer, so the box it is asked about must not leak into the picture.
  for (const stencil of ARCHITECTURE_STENCILS) {
    const small = stencil.render({ width: 40, height: 40, isDark: true });
    const large = stencil.render({ width: 400, height: 400, isDark: true });
    assert.equal(small, large, `${stencil.id} draws differently at a different size`);
  }
});

test('every tech logo is registered with its own brand colour and grid', () => {
  assert.equal(TECH_ICON_STENCILS.length, 125);

  for (const stencil of TECH_ICON_STENCILS) {
    assert.match(stencil.id, /^tech-/, `${stencil.id} is not namespaced`);
    assert.ok(stencil.title.length > 0, `${stencil.id} has no title`);
    assert.match(stencil.accentColor, /^#[0-9a-fA-F]{6}$/, `${stencil.id} has a bad colour`);
    assert.equal(stencil.viewBox?.width, 24, `${stencil.id} is not on the 24px grid`);
    assert.equal(stencil.viewBox?.height, 24);
  }
});

test('a tech logo draws its path, in the brand colour or the theme ink', () => {
  for (const stencil of TECH_ICON_STENCILS) {
    const markup = stencil.render({ width: 64, height: 64, isDark: true });

    // Both moveto forms are in the source data: 33 logos are absolute and two
    // open with a relative `m`.
    assert.match(markup, /<path d="[Mm]/, `${stencil.id} draws no path`);
    assert.ok(markup.includes(stencil.accentColor), `${stencil.id} ignores its brand colour`);
    assert.ok(!markup.includes('undefined'), `${stencil.id} interpolated undefined`);
  }
});

test('a tech logo honours an explicit colour override', () => {
  const [logo] = TECH_ICON_STENCILS;
  const markup = logo.render({ width: 64, height: 64, isDark: true, color: '#ff0000' });

  assert.ok(markup.includes('#ff0000'));
  assert.ok(!markup.includes(logo.accentColor));
});

test('the two stencil families share no ids', () => {
  const archIds = new Set(ARCHITECTURE_STENCILS.map((s) => s.id));
  const clashes = TECH_ICON_STENCILS.filter((s) => archIds.has(s.id)).map((s) => s.id);

  assert.deepEqual(clashes, []);
});

test('the built-in registry holds both families', () => {
  assert.equal(BUILTIN_STENCILS.length, 177, '52 architecture stencils plus 125 tech/cloud logos');
  assert.equal(BUILTIN_STENCIL_REGISTRY.list().length, 177);
});

test('aws architecture stencils and aliases resolve correctly', () => {
  const awsIds = [
    'tech-aws-ec2',
    'tech-aws-lambda',
    'tech-aws-ecs',
    'tech-aws-eks',
    'tech-aws-fargate',
    'tech-aws-s3',
    'tech-aws-ebs',
    'tech-aws-efs',
    'tech-aws-rds',
    'tech-aws-dynamodb',
    'tech-aws-aurora',
    'tech-aws-elasticache',
    'tech-aws-vpc',
    'tech-aws-cloudfront',
    'tech-aws-route53',
    'tech-aws-apigateway',
    'tech-aws-elb',
    'tech-aws-sqs',
    'tech-aws-sns',
    'tech-aws-eventbridge',
    'tech-aws-stepfunctions',
    'tech-aws-iam',
    'tech-aws-cognito',
    'tech-aws-cloudwatch',
    'tech-aws-kms',
    'tech-aws-waf',
    'tech-aws-amplify',
    'tech-aws-opensearch',
    'tech-aws-redshift',
    'tech-aws-kinesis',
    'tech-aws-sagemaker',
    'tech-aws-bedrock',
    'tech-aws-glue',
    'tech-aws-secretsmanager',
    'tech-aws-athena',
    'tech-aws-ecr',
    'tech-aws-apprunner',
    'tech-aws-cloudtrail',
    'tech-aws-autoscaling',
    'tech-aws-appsync',
  ];
  for (const id of awsIds) {
    assert.equal(BUILTIN_STENCIL_REGISTRY.get(id)?.id, id, `${id} should resolve`);
  }
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('aws-ec2')?.id, 'tech-aws-ec2');
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('aws-lambda')?.id, 'tech-aws-lambda');
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('aws-s3')?.id, 'tech-aws-s3');
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('aws-rds')?.id, 'tech-aws-rds');
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('aws-dynamodb')?.id, 'tech-aws-dynamodb');
});

test('stripe payment gateway and aliases resolve correctly', () => {
  assert.ok(BUILTIN_STENCIL_REGISTRY.get('tech-stripe'));
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('tech-stripe')?.id, 'tech-stripe');
  assert.ok(BUILTIN_STENCIL_REGISTRY.get('arch-payment-gateway'));
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('arch-payment-gateway')?.id, 'arch-payment-gateway');
  // Aliases
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('arch-stripe')?.id, 'arch-payment-gateway');
  assert.equal(BUILTIN_STENCIL_REGISTRY.get('stripe')?.id, 'tech-stripe');
});

test('kubernetes, gcp and azure cloud stencils resolve correctly', () => {
  const cloudIds = [
    'tech-k8s-pod',
    'tech-k8s-service',
    'tech-k8s-deployment',
    'tech-k8s-ingress',
    'tech-gcp-gke',
    'tech-gcp-cloudrun',
    'tech-gcp-compute',
    'tech-gcp-storage',
    'tech-gcp-bigquery',
    'tech-azure-aks',
    'tech-azure-vm',
    'tech-azure-functions',
    'tech-azure-cosmos',
    'tech-azure-vnet',
  ];

  for (const id of cloudIds) {
    const stencil = BUILTIN_STENCIL_REGISTRY.get(id);
    assert.ok(stencil, `Expected stencil ${id} to resolve`);
    assert.equal(stencil.id, id);
    assert.ok(stencil.title.length > 0);
  }
});

test('every built-in stencil is reachable by the id the panel uses', () => {
  for (const stencil of BUILTIN_STENCILS) {
    assert.equal(
      BUILTIN_STENCIL_REGISTRY.get(stencil.id)?.id,
      stencil.id,
      `${stencil.id} is in the list but not resolvable`
    );
  }
});

test('every stencil is placed at the shape its artwork was drawn in', () => {
  // A stencil draws through `preserveAspectRatio="xMidYMid meet"`, so artwork
  // whose proportions do not match the box it lands in is letterboxed — the
  // picture floats in a strip of empty node. That strip is what shows up as
  // padding around a dropped component, and it grows with the box, because a
  // resize scales the node while the drawing stays centred inside it.
  //
  // So the measurement is that strip, in pixels: what the artwork covers at the
  // scale `meet` gives it, taken away from the node it was given. Under a pixel
  // is the bar, which is where rounding the placed size to whole pixels leaves
  // it — the sizes themselves come from the artwork's own aspect ratio, so a
  // whole-pixel node can only ever be a fraction of a pixel out.
  for (const stencil of BUILTIN_STENCILS) {
    const viewBox = stencilViewBox(stencil);
    const scale = Math.min(
      stencil.defaultWidth / viewBox.width,
      stencil.defaultHeight / viewBox.height
    );
    const spare = Math.max(
      stencil.defaultWidth - viewBox.width * scale,
      stencil.defaultHeight - viewBox.height * scale
    );

    assert.ok(
      spare < 1,
      `${stencil.id} is placed ${stencil.defaultWidth}x${stencil.defaultHeight} for artwork ` +
        `${viewBox.width}x${viewBox.height}, leaving a ${spare.toFixed(2)}px empty strip`
    );
  }
});

test('no architecture stencil is scaled from the square it was authored on', () => {
  // The authored 100x100 square is a canvas to draw on, not a promise about how
  // much of it is used. A stencil left on the default would be one whose
  // artwork was never measured, and it would draw with the margins this whole
  // arrangement exists to remove — so every fragment says where its ink is.
  for (const stencil of ARCHITECTURE_STENCILS) {
    assert.ok(stencil.viewBox, `${stencil.id} declares no view box`);

    const { x, y, width, height } = stencil.viewBox;
    assert.ok(width > 0 && height > 0, `${stencil.id} has a degenerate view box`);
    assert.ok(
      x >= 0 && y >= 0 && x + width <= 100 && y + height <= 100,
      `${stencil.id} paints outside the square it was authored on: ${x} ${y} ${width} ${height}`
    );
    // Measured, not assumed: a fragment occupying the whole square is a
    // coincidence, and 51 of them would mean the measurement never ran.
    assert.ok(
      width < 100 || height < 100,
      `${stencil.id} appears to be measured as the full authored square`
    );
  }
});

test('a label never decides where a stencil is scaled from', () => {
  // Text is the one thing an SVG cannot measure without a font, so the
  // measurement approximates it. That approximation is only allowed to be
  // approximate because it never decides anything: every fragment here is
  // bounded by its drawing, and a label that stuck out of its frame would make
  // the box it is measured in wrong.
  const withoutLabels = (markup) => markup.replace(/<text[^>]*>[\s\S]*?<\/text>/g, '');

  for (const stencil of ARCHITECTURE_STENCILS) {
    const markup = stencil.render({
      width: stencil.defaultWidth,
      height: stencil.defaultHeight,
      isDark: false,
    });
    const stripped = withoutLabels(markup);
    if (stripped === markup) continue;

    assert.deepEqual(
      measureArtwork(stripped),
      stencil.viewBox,
      `${stencil.id} is scaled from a box its label decided`
    );
  }
});

test('the catalogue the panel drags from places the same box as the registry', () => {
  // A tile's payload carries the catalogue's own width and height, and the
  // engine falls back to the definition's. The two agree today because the
  // definitions are built from the catalogue, and this is what says so if that
  // ever stops being true: a drag would then land a different box from a click.
  for (const meta of ARCHITECTURE_STENCIL_META) {
    const definition = BUILTIN_STENCIL_REGISTRY.get(meta.id);

    assert.equal(definition?.defaultWidth, meta.width, meta.id);
    assert.equal(definition?.defaultHeight, meta.height, meta.id);
  }
});
