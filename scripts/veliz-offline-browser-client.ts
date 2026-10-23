// Browser harness for the disposable LOCAL Veliz database only. Bundle to a
// temporary public asset for the audit, then remove that asset before delivery.
import { enqueueOperation, listOperations } from '../lib/offline/queue';
import { syncOfflineQueue } from '../lib/offline/sync';
import { generateClientOperationId } from '../lib/pos2/offline/canonical';
if (location.origin !== 'http://127.0.0.1:3107') throw Error('LOCAL_TEST_ORIGIN_REQUIRED');
const out = document.querySelector('pre')!;
const nativeFetch = window.fetch.bind(window);
const render = async () => { out.textContent = JSON.stringify(await listOperations(), null, 2); };
document.querySelector('#enqueue')!.addEventListener('click', async () => {
  const id = generateClientOperationId();
  await enqueueOperation({ id, kind: 'pos.sale.create', createdAt: new Date().toISOString(), payload: { branchId: 'veliz', items: [{ variantId: 'qa-variant', quantity: 1 }], payments: [{ method: 'EFECTIVO', amount: 30 }], inventoryMode: 'v2', clientOperationId: id } });
  await render();
});
document.querySelector('#lost-response')!.addEventListener('click', async () => {
  window.fetch = async (...args) => { const response = await nativeFetch(...args); if (String(args[0]) === '/api/pos/sales' && response.ok) throw Error('LOCAL_QA_RESPONSE_LOST_AFTER_COMMIT'); return response; };
  try { await syncOfflineQueue(); } finally { window.fetch = nativeFetch; await render(); }
});
document.querySelector('#sync')!.addEventListener('click', async () => { await syncOfflineQueue(); await render(); });
void render();
