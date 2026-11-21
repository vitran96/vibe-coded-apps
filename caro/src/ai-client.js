'use strict';
// 04 AI client (Web Worker with fallback)
// ============================================================
class AIClient {
  constructor() {
    this.worker = null;
    this.fallbackAI = null;
    this.pending = new Map();
    this.reqId = 0;
    this.initWorker();
  }
  initWorker() {
    try {
      const src = `
        ${checkWin.toString()}
        ${isDraw.toString()}
        ${createAI.toString()}
        const ai = createAI();
        self.onmessage = function(e) {
          try {
            const res = ai.chooseMove(e.data);
            self.postMessage({ id: e.data.id, res });
          } catch(err) {
            self.postMessage({ id: e.data.id, error: err.message });
          }
        };
      `;
      const blob = new Blob([src], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      this.worker.onmessage = (e) => {
        const { id, res, error } = e.data;
        const cb = this.pending.get(id);
        if (cb) {
          this.pending.delete(id);
          if (error) cb.reject(new Error(error));
          else cb.resolve(res);
        }
      };
      this.worker.onerror = () => {
        this.worker = null; // fallback to main thread
      };
    } catch {
      this.worker = null;
    }
  }
  getMove(req) {
    return new Promise((resolve, reject) => {
      const id = ++this.reqId;
      if (this.worker) {
        this.pending.set(id, { resolve, reject });
        this.worker.postMessage({ id, ...req });
      } else {
        setTimeout(() => {
          try {
            if (!this.fallbackAI) this.fallbackAI = createAI();
            const res = this.fallbackAI.chooseMove(req);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        }, 10);
      }
    });
  }
}

// ============================================================
