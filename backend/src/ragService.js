/**
 * RAGFlow integration for CityEye knowledge base.
 *
 * RAGFlow provides:
 *   - Document upload & chunking
 *   - Semantic search over knowledge base
 *   - Chat with retrieval (RAG)
 *
 * Knowledge base contains:
 *   - Department rules & responsibilities
 *   - Routing rules
 *   - SLA policies
 *   - District information
 *   - Shared-case protocol
 *
 * When RAGFlow is not available, falls back to local knowledge base
 * (assistantKnowledge.js) so the system never breaks.
 */

const RAGFLOW_API_URL = () => process.env.RAGFLOW_API_URL || '';
const RAGFLOW_API_KEY = () => process.env.RAGFLOW_API_KEY || '';
const RAGFLOW_DATASET_ID = () => process.env.RAGFLOW_DATASET_ID || '';

/* ------------------------------------------------------------------ */
/*  Low-level RAGFlow API                                              */
/* ------------------------------------------------------------------ */

async function ragflowFetch(path, method = 'GET', body = null) {
  const base = RAGFLOW_API_URL();
  if (!base) throw new Error('RAGFLOW_API_URL not configured');

  const headers = {
    Authorization: `Bearer ${RAGFLOW_API_KEY()}`,
    'Content-Type': 'application/json',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${base}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RAGFlow ${path} error ${res.status}: ${text}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Dataset management                                                 */
/* ------------------------------------------------------------------ */

/**
 * List existing datasets.
 */
export async function listDatasets() {
  const data = await ragflowFetch('/api/v1/datasets');
  return data?.data || [];
}

/**
 * Create a new dataset (knowledge base).
 */
export async function createDataset(name, description = '') {
  const data = await ragflowFetch('/api/v1/datasets', 'POST', {
    name,
    description,
    language: 'Russian',
    chunk_method: 'naive',
    parser_config: {
      chunk_token_num: 512,
      layout_recognize: false,
    },
  });
  return data?.data;
}

/**
 * Upload a document to a dataset.
 */
export async function uploadDocument(datasetId, fileName, content) {
  const base = RAGFLOW_API_URL();
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/markdown' }), fileName);

  const res = await fetch(`${base}/api/v1/datasets/${datasetId}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RAGFLOW_API_KEY()}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RAGFlow upload error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Trigger parsing of uploaded documents.
 */
export async function parseDocuments(datasetId, documentIds) {
  return ragflowFetch(`/api/v1/datasets/${datasetId}/chunks`, 'POST', {
    document_ids: documentIds,
  });
}

/* ------------------------------------------------------------------ */
/*  Retrieval (search)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Search the knowledge base for relevant chunks.
 * @param {string} query - search query
 * @param {number} [topK=5] - number of results
 * @returns {Promise<Array<{ content: string, score: number, document_name: string }>>}
 */
export async function retrieveChunks(query, topK = 5) {
  const datasetId = RAGFLOW_DATASET_ID();
  if (!datasetId) throw new Error('RAGFLOW_DATASET_ID not set');

  const data = await ragflowFetch(`/api/v1/retrieval`, 'POST', {
    question: query,
    dataset_ids: [datasetId],
    top_k: topK,
    similarity_threshold: 0.2,
    keyword: true,
    rerank_id: '',  // use default reranker
  });

  return (data?.data?.chunks || []).map(chunk => ({
    content: chunk.content || chunk.content_with_weight || '',
    score: chunk.similarity || chunk.score || 0,
    document_name: chunk.document_name || '',
  }));
}

/* ------------------------------------------------------------------ */
/*  RAG-enhanced chat                                                  */
/* ------------------------------------------------------------------ */

/**
 * Chat with RAG context from knowledge base.
 * Creates a session and sends a message with retrieval.
 */
export async function ragChat(sessionId, question) {
  const data = await ragflowFetch(`/api/v1/chats/${sessionId}/completions`, 'POST', {
    question,
    stream: false,
  });
  return data?.data?.answer || '';
}

/* ------------------------------------------------------------------ */
/*  High-level: get routing context from knowledge base                */
/* ------------------------------------------------------------------ */

/**
 * Retrieve relevant knowledge for routing a city issue.
 * This is the main function used by the AI pipeline.
 *
 * @param {{ type: string, severity: string, address: string, reporterRole: string, aiComment: string }} params
 * @returns {Promise<string>} concatenated context from knowledge base
 */
export async function getRoutingContext({ type, severity, address, reporterRole, aiComment }) {
  if (!isRagConfigured()) return '';

  const query = buildRoutingQuery({ type, severity, address, reporterRole, aiComment });

  try {
    const chunks = await retrieveChunks(query, 3);
    if (chunks.length === 0) return '';

    return chunks
      .map((c, i) => `[KB ${i + 1}] (${c.document_name}, score: ${c.score.toFixed(2)})\n${c.content.slice(0, 400)}`)
      .join('\n\n');
  } catch (err) {
    console.warn('RAG retrieval failed:', err.message);
    return '';
  }
}

function buildRoutingQuery({ type, severity, address, reporterRole, aiComment }) {
  const parts = [];
  if (type) parts.push(`тип проблемы: ${type}`);
  if (severity) parts.push(`серьёзность: ${severity}`);
  if (reporterRole) parts.push(`кто подал: ${reporterRole}`);
  if (address) parts.push(`адрес: ${address}`);
  if (aiComment) parts.push(aiComment);
  parts.push('Какой департамент и маршрут назначить? Какой SLA применить?');
  return parts.join('. ');
}

/* ------------------------------------------------------------------ */
/*  Health check                                                       */
/* ------------------------------------------------------------------ */

export function isRagConfigured() {
  return Boolean(RAGFLOW_API_URL() && RAGFLOW_API_KEY() && RAGFLOW_DATASET_ID());
}
