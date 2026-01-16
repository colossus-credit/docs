import { generateFiles } from 'fumadocs-openapi';
import { openapi } from '../src/lib/openapi';
import { copyFile } from 'fs/promises';

const SPEC_SOURCE = '/Users/prudhvirampey/Documents/colossus-stack/services/iso8583-bundler/openapi.json';
const SPEC_DEST = './openapi.json';
const output = './content/docs/api-reference';

// Step 1: Copy latest spec from iso8583-bundler service
await copyFile(SPEC_SOURCE, SPEC_DEST);
console.log(`Copied spec from ${SPEC_SOURCE}`);

// Step 2: Generate individual endpoint pages + meta.json + index with cards
await generateFiles({
  input: openapi,
  output,
  per: 'operation',
  includeDescription: true,
  async beforeWrite(files) {
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
        pages: ['index', ...pages]
      }, null, 2)
    });

    // Add index.mdx with cards
    files.push({
      path: 'index.mdx',
      content: `---
title: Schema
description: Overview of all available API endpoints.
---

import { Cards, Card } from 'fumadocs-ui/components/card';

<Cards>
${cards.join('\n')}
</Cards>
`
    });
  }
});

console.log('Generation complete!');
