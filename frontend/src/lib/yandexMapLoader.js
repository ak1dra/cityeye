export function waitForYmaps({ timeoutMs = 15000, pollIntervalMs = 100 } = {}) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps can only load in the browser.'));
  }

  return new Promise((resolve, reject) => {
    let intervalId = null;
    let timeoutId = null;

    const cleanup = () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      intervalId = null;
      timeoutId = null;
    };

    const resolveReady = () => {
      try {
        window.ymaps.ready(() => {
          cleanup();
          resolve(window.ymaps);
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    if (window.ymaps) {
      resolveReady();
      return;
    }

    intervalId = window.setInterval(() => {
      if (window.ymaps) {
        resolveReady();
      }
    }, pollIntervalMs);

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Yandex Maps script did not load in time.'));
    }, timeoutMs);
  });
}

export function loadYmapsModule(ymaps, moduleName) {
  if (!ymaps?.modules?.require) {
    return Promise.reject(new Error(`${moduleName} module is unavailable.`));
  }

  return new Promise((resolve, reject) => {
    ymaps.modules.require([moduleName], loadedModule => resolve(loadedModule), reject);
  });
}
