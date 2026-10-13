// ai-client.js — Web Worker AI client wrapper with fail-safe fallback
(() => {
  let worker = null;
  let currentReqId = 0;
  let searchStartTime = 0;

  function createWorker() {
    if (worker) {
      try { worker.terminate(); } catch {}
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
        if (!data || data.type !== 'search') return;
        try {
          const pos = XQ.parseFen(data.fen);
          const result = XQ.searchRoot(pos, {
            level: data.level,
            timeBudget: data.timeBudget,
            historyHashes: data.historyHashes,
            movesHistory: data.movesHistory,
            rules: data.rules
          });
          let move = result ? result.move : null;
          let moveInt = result ? result.moveInt : 0;
          if (!moveInt) {
            const legals = XQ.legalMoves(pos);
            if (legals.length > 0) {
              moveInt = legals[0];
              move = XQ.moveToIccs(moveInt);
            }
          }
          postMessage({
            type: 'move',
            reqId: data.reqId,
            move,
            moveInt,
            score: result ? result.score : 0,
            depth: result ? result.depth : 1,
            nodes: result ? result.nodes : 1
          });
        } catch (err) {
          postMessage({
            type: 'error',
            reqId: data.reqId,
            error: String(err && err.message ? err.message : err)
          });
        }
      };
    `;

    try {
      const blob = new Blob([workerSrc], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
      worker.onerror = function(err) {
        console.warn('AI Web Worker encountered an error, falling back to sync engine:', err);
        try { worker.terminate(); } catch {}
        worker = null;
      };
    } catch (e) {
      console.warn('Web Worker creation failed, will use fallback sync search:', e);
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
      const minDisplayMs = 300;
      let handled = false;

      function fallbackSearch() {
        if (handled || reqId !== currentReqId) return;
        handled = true;
        try {
          const pos = window.XQ.parseFen(fen);
          let result = window.XQ.searchRoot(pos, options);
          if (!result || !result.moveInt) {
            const legals = window.XQ.legalMoves(pos);
            if (legals.length > 0) {
              result = {
                moveInt: legals[0],
                move: window.XQ.moveToIccs(legals[0]),
                score: 0,
                depth: 1,
                nodes: 1
              };
            }
          }
          const elapsed = Date.now() - searchStartTime;
          const delay = Math.max(0, minDisplayMs - elapsed);
          setTimeout(() => {
            if (reqId === currentReqId) callback(result);
          }, delay);
        } catch (e) {
          console.error('Fallback AI search error:', e);
          try {
            const pos = window.XQ.parseFen(fen);
            const legals = window.XQ.legalMoves(pos);
            const fallbackM = legals.length > 0 ? legals[0] : 0;
            callback({
              moveInt: fallbackM,
              move: fallbackM ? window.XQ.moveToIccs(fallbackM) : null
            });
          } catch {
            callback({ moveInt: 0, move: null });
          }
        }
      }

      if (!worker) {
        setTimeout(fallbackSearch, 10);
        return reqId;
      }

      // Watchdog timer: If worker doesn't respond in timeBudget + 1200ms, use fallback
      const timeBudget = (options && options.timeBudget) || 1000;
      const watchdog = setTimeout(() => {
        if (!handled && reqId === currentReqId) {
          console.warn('Worker timed out, triggering fallback search');
          fallbackSearch();
        }
      }, Math.max(2200, timeBudget + 1200));

      const handler = (e) => {
        const data = e.data;
        if (!data || data.reqId !== reqId) return;
        clearTimeout(watchdog);
        worker.removeEventListener('message', handler);

        if (data.type === 'error' || !data.moveInt) {
          fallbackSearch();
          return;
        }

        if (handled || reqId !== currentReqId) return;
        handled = true;
        const elapsed = Date.now() - searchStartTime;
        const delay = Math.max(0, minDisplayMs - elapsed);
        setTimeout(() => {
          if (reqId === currentReqId) callback(data);
        }, delay);
      };

      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'search',
        reqId,
        fen,
        historyHashes: options.historyHashes || [],
        movesHistory: options.movesHistory || [],
        level: options.level || 'medium',
        timeBudget,
        rules: options.rules || { perpetual: true, moveLimit: true }
      });

      return reqId;
    }
  };

  window.XQ = window.XQ || {};
  window.XQ.AiClient = AiClient;
})();
