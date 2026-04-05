/**
 * Setup RAGFlow knowledge base.
 *
 * This script:
 *   1. Creates a dataset "CityEye Knowledge Base" in RAGFlow
 *   2. Uploads all documents from /knowledge-base/
 *   3. Triggers document parsing
 *   4. Prints the dataset ID (add to .env as RAGFLOW_DATASET_ID)
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env node -r dotenv/config scripts/setup-ragflow.js
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAGFLOW_API_URL = process.env.RAGFLOW_API_URL;
const RAGFLOW_API_KEY = process.env.RAGFLOW_API_KEY;
const KB_DIR = join(__dirname, '..', '..', 'knowledge-base');

if (!RAGFLOW_API_URL || !RAGFLOW_API_KEY) {
  console.error('Set RAGFLOW_API_URL and RAGFLOW_API_KEY in .env');
  process.exit(1);
}

async function ragFetch(path, method = 'GET', body = null) {
  const headers = {
    Authorization: `Bearer ${RAGFLOW_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${RAGFLOW_API_URL}${path}`, opts);
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    console.error(`Error ${path}:`, res.status, JSON.stringify(data));
    return null;
  }
  return data.data;
}

async function ragUpload(datasetId, fileName, content) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/markdown' }), fileName);

  const res = await fetch(`${RAGFLOW_API_URL}/api/v1/datasets/${datasetId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RAGFLOW_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Upload error for ${fileName}:`, res.status, JSON.stringify(data));
    return null;
  }
  return data.data;
}

async function main() {
  console.log('=== CityEye RAGFlow Setup ===\n');

  // 1. Create dataset
  console.log('1. Creating dataset...');
  const dataset = await ragFetch('/api/v1/datasets', 'POST', {
    name: 'CityEye Knowledge Base',
    description: 'Knowledge base for city infrastructure issue routing: departments, SLA, districts, shared-case protocol',
    chunk_method: 'naive',
    parser_config: {
      chunk_token_num: 512,
    },
  });

  if (!dataset) {
    console.error('Failed to create dataset');
    process.exit(1);
  }

  const datasetId = dataset.id;
  console.log(`   Dataset created: ${datasetId}\n`);

  // 2. Upload documents
  console.log('2. Uploading documents...');
  const files = await readdir(KB_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md')).sort();
  const docIds = [];

  for (const file of mdFiles) {
    const content = await readFile(join(KB_DIR, file), 'utf-8');
    console.log(`   Uploading ${file} (${content.length} chars)...`);
    const result = await ragUpload(datasetId, file, content);
    if (result) {
      const ids = Array.isArray(result) ? result.map(d => d.id) : [result.id];
      docIds.push(...ids.filter(Boolean));
      console.log(`   OK: ${ids.length} document(s)`);
    }
  }

  // 3. Parse documents
  if (docIds.length > 0) {
    console.log(`\n3. Parsing ${docIds.length} documents...`);
    const parseResult = await ragFetch(`/api/v1/datasets/${datasetId}/chunks`, 'POST', {
      document_ids: docIds,
    });
    console.log('   Parse triggered:', parseResult ? 'OK' : 'check RAGFlow UI');
  }

  // 4. Print result
  console.log('\n=== DONE ===');
  console.log(`\nAdd to your backend/.env:`);
  console.log(`RAGFLOW_DATASET_ID=${datasetId}`);
  console.log(`\nDataset URL: ${RAGFLOW_API_URL} → dataset ${datasetId}`);
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
