import { generateFiles } from 'fumadocs-openapi';
import { openapi } from '../src/lib/openapi';
import { readFile, writeFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';

const SPEC_SOURCE = './openapi/openapi.yaml';
const SPEC_DEST = './openapi/openapi.json';
const output = './content/docs/api-reference';

// Step 1: Read spec from local source and convert YAML to JSON
console.log(`Reading spec from ${SPEC_SOURCE}...`);
const yamlContent = await readFile(SPEC_SOURCE, 'utf-8');
const spec = parseYaml(yamlContent);

// Save as JSON (commit this to the repo)
await writeFile(SPEC_DEST, JSON.stringify(spec, null, 2));
console.log(`Saved spec to ${SPEC_DEST}`);

const schemas = spec.components?.schemas || {};
const schemaNames = Object.keys(schemas);

// Helper to convert schema references to links
function linkifySchemas(content: string): string {
  let result = content;
  for (const name of schemaNames) {
    // Replace `SchemaName` with link (but not inside existing links or code blocks)
    const pattern = new RegExp(`\`${name}\`(?! schema)`, 'g');
    result = result.replace(pattern, `[\`${name}\`](/api-reference/schemas#${name.toLowerCase()})`);
    // Also handle "SchemaName schema" pattern
    const patternWithSchema = new RegExp(`\`${name}\` schema`, 'g');
    result = result.replace(patternWithSchema, `[\`${name}\`](/api-reference/schemas#${name.toLowerCase()}) schema`);
  }
  return result;
}

// Helper to recursively generate property table rows for nested objects
function generatePropsTable(props: Record<string, any>, required: string[], prefix = ''): string[] {
  const rows: string[] = [];

  for (const [propName, propDef] of Object.entries(props)) {
    const fullName = prefix ? `${prefix}.${propName}` : propName;
    const type = propDef.type || propDef.$ref?.split('/').pop() || 'any';
    const isRequired = required.includes(propName) ? '✓' : '';
    const desc = (propDef.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

    rows.push(`| \`${fullName}\` | \`${type}\` | ${isRequired} | ${desc} |`);

    // Recursively handle nested objects
    if (propDef.type === 'object' && propDef.properties) {
      const nestedRequired = propDef.required || [];
      rows.push(...generatePropsTable(propDef.properties, nestedRequired, fullName));
    }
  }

  return rows;
}

// Step 2: Generate individual endpoint pages + meta.json + index with cards
await generateFiles({
  input: openapi,
  output,
  per: 'operation',
  includeDescription: true,
  async beforeWrite(files) {
    // Linkify schema references in all generated files
    for (const file of files) {
      file.content = linkifySchemas(file.content);
    }

    // Get all operation entries
    const entries = Object.values(this.generatedEntries).flat();
    const operations = entries.filter((e: any) => e.type === 'operation');

    // Build pages array and cards content
    const pages: string[] = [];
    const cards: string[] = [];

    for (const op of operations) {
      const pagePath = (op as any).path.replace('.mdx', '');
      const title = (op as any).info?.title || pagePath;
      const description = (op as any).info?.description || '';
      const method = (op as any).item?.method?.toUpperCase() || '';

      // Color based on HTTP method
      const colorClass = method === 'POST' ? 'text-blue-600 dark:text-blue-400'
        : method === 'PUT' ? 'text-yellow-600 dark:text-yellow-400'
        : method === 'DELETE' ? 'text-red-600 dark:text-red-400'
        : method === 'PATCH' ? 'text-orange-600 dark:text-orange-400'
        : 'text-green-600 dark:text-green-400';

      pages.push(pagePath);
      cards.push(`<Card href="/api-reference/${pagePath}" title={<><span className="font-mono font-medium ${colorClass}">${method}</span> ${title}</>} description="${description.replace(/"/g, "'").split('\n')[0]}" />`);
    }

    // Add meta.json
    files.push({
      path: 'meta.json',
      content: JSON.stringify({
        title: 'API Reference',
        pages: ['index', 'schemas', ...pages]
      }, null, 2)
    });

    // Add index.mdx with cards
    files.push({
      path: 'index.mdx',
      content: `---
title: Endpoints
description: Overview of all available API endpoints.
---

import { Cards, Card } from 'fumadocs-ui/components/card';

<Cards>
${cards.join('\n')}
</Cards>
`
    });

    // Generate schemas page
    const schemaCards: string[] = [];
    for (const [name, schema] of Object.entries(schemas)) {
      const desc = (schema as any).description?.split('\n')[0] || '';
      schemaCards.push(`<Card href="/api-reference/schemas#${name.toLowerCase()}" title="${name}" description="${desc.replace(/"/g, "'")}" />`);
    }

    const schemaDetails: string[] = [];
    for (const [name, schema] of Object.entries(schemas)) {
      const s = schema as any;
      const desc = s.description || '';
      const props = s.properties || {};
      const required = s.required || [];

      let propsTable = '';
      if (Object.keys(props).length > 0) {
        const tableRows = generatePropsTable(props, required);
        propsTable = `| Property | Type | Required | Description |
|----------|------|----------|-------------|
${tableRows.join('\n')}`;
      }

      schemaDetails.push(`## ${name}

${desc}

${propsTable}`);
    }

    files.push({
      path: 'schemas.mdx',
      content: `---
title: Schemas
description: Data models and type definitions.
---

import { Cards, Card } from 'fumadocs-ui/components/card';

<Cards>
${schemaCards.join('\n')}
</Cards>

---

${schemaDetails.join('\n\n---\n\n')}
`
    });
  }
});

console.log('Generation complete!');
