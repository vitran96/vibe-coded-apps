// ai-client.js — Web Worker AI client wrapper
(() => {
  let worker = null;
  let currentReqId = 0;
  let searchStartTime = 0;

  function createWorker() {
    if (worker) {
      worker.terminate();
      worker = null;
    }

    const workerSrc = `
      const XQ = {};
      (${defineRules.toString()})(XQ);
      (${defineNotation.toString()})(XQ);
      (${defineBook.toString()})(XQ);
      (${defineEngine.toString()})(XQ);

      onmessage = function(e) {
        const data = e.data;
        if (data.type === 'search') {
          const pos = XQ.parseFen(data.fen);
          const result = XQ.searchRoot(pos, {
            level: data.level,
            timeBudget: data.timeBudget,
            historyHashes: data.historyHashes,
            movesHistory: data.movesHistory,
            rules: data.rules
          });
          postMessage({
            type: 'move',
            reqId: data.reqId,
            move: result.move,
            moveInt: result.moveInt,
            score: result.score,
            depth: result.depth,
            nodes: result.nodes
          });
        }
      };
    `;

    try {
      const blob = new Blob([workerSrc], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
    } catch (e) {
      console.warn('Web Worker creation failed, will use fallback search:', e);
      worker = null;
    }
  }

  const AiClient = {
    init() {
      createWorker();
    },

    cancel() {
      currentReqId++;
      if (worker && Date.now() - searchStartTime > 300) {
        createWorker();
      }
    },

    requestMove(fen, options, callback) {
      const reqId = ++currentReqId;
      searchStartTime = Date.now();
      const minDisplayMs = 400;

      if (!worker) {
        // Fallback synchronous search via setTimeout
        setTimeout(() => {
          if (reqId !== currentReqId) return;
          const pos = window.XQ.parseFen(fen);
          const result = window.XQ.searchRoot(pos, options);
          const elapsed = Date.now() - searchStartTime;
          const delay = Math.max(0, minDisplayMs - elapsed);
          setTimeout(() => {
            if (reqId === currentReqId) callback(result);
          }, delay);
        }, 10);
        return reqId;
      }

      const handler = (e) => {
        const data = e.data;
        if (data.type === 'move' && data.reqId === reqId) {
          worker.removeEventListener('message', handler);
          const elapsed = Date.now() - searchStartTime;
          const delay = Math.max(0, minDisplayMs - elapsed);
          setTimeout(() => {
            if (reqId === currentReqId) callback(data);
          }, delay);
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'search',
        reqId,
        fen,
        historyHashes: options.historyHashes || [],
        movesHistory: options.movesHistory || [],
        level: options.level || 'medium',
        timeBudget: options.timeBudget || 1000,
        rules: options.rules || { perpetual: true, moveLimit: true }
      });

      return reqId;
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.AiClient = AiClient;
})();
