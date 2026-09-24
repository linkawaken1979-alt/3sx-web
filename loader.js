(() => {
  const EXPECTED_SHA =
    'f9fa50f3a124ec9fa9465aa9c8546c2d867887eb39f711a070762a0324ba5604';

  const EXPECTED_SIZE = 642492416;

  const PART_COUNT = 31;
  const PART_PREFIX = 'SF33RD.AFS.part';

  const DB_NAME = '3sx-web';
  const STORE = 'files';
  const KEY = 'SF33RD.AFS';

  const PREF = '/libsdl/CrowdedStreet/3SX';

  const $ = id => document.getElementById(id);

  const show = (id, on) => {
    const el = $(id);
    if (el) {
      el.hidden = !on;
    }
  };

  let afsBlob = null;
  let started = false;

  function setError(msg) {
    const error = $('error');

    if (!error) {
      return;
    }

    error.textContent = msg || '';
    show('error', !!msg);
  }

  function busy(title, text, value) {
    show('need-file', false);
    show('ready', false);
    show('busy', true);

    const busyTitle = $('busy-title');
    const busyText = $('busy-text');
    const bar = $('bar');

    if (busyTitle) {
      busyTitle.textContent = title;
    }

    if (busyText) {
      busyText.textContent = text || '';
    }

    if (bar) {
      if (value === undefined) {
        bar.removeAttribute('value');
      } else {
        bar.value = value;
      }
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };

      req.onsuccess = () => {
        resolve(req.result);
      };

      req.onerror = () => {
        reject(req.error);
      };
    });
  }

  async function dbGet() {
    try {
      const db = await openDb();

      return await new Promise((resolve, reject) => {
        const req = db
          .transaction(STORE)
          .objectStore(STORE)
          .get(KEY);

        req.onsuccess = () => {
          resolve(req.result || null);
        };

        req.onerror = () => {
          reject(req.error);
        };
      });
    } catch (e) {
      console.warn(
        '[3SX Loader] Could not read cached AFS:',
        e
      );

      return null;
    }
  }

  async function dbPut(blob) {
    try {
      const db = await openDb();

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');

        tx.objectStore(STORE).put(blob, KEY);

        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      console.log(
        '[3SX Loader] Combined AFS saved to IndexedDB.'
      );
    } catch (e) {
      console.warn(
        '[3SX Loader] Could not cache AFS in IndexedDB:',
        e
      );
    }
  }

  const hex = buf =>
    [...new Uint8Array(buf)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

  async function verify(blob) {
    if (blob.size !== EXPECTED_SIZE) {
      throw new Error(
        `The combined SF33RD.AFS is ${blob.size.toLocaleString()} bytes, but it should be ${EXPECTED_SIZE.toLocaleString()} bytes.`
      );
    }

    if (!(window.crypto && crypto.subtle)) {
      console.warn(
        '[3SX Loader] Web Crypto is unavailable; skipping SHA-256 verification.'
      );

      return;
    }

    busy(
      'Checking file',
      'Verifying the combined SF33RD.AFS checksum...'
    );

    const digest = hex(
      await crypto.subtle.digest(
        'SHA-256',
        await blob.arrayBuffer()
      )
    );

    if (digest !== EXPECTED_SHA) {
      throw new Error(
        'Checksum mismatch: the combined SF33RD.AFS data is not the version 3SX expects.'
      );
    }

    console.log(
      '[3SX Loader] SF33RD.AFS checksum verified.'
    );
  }

  async function accept(blob) {
    setError('');

    try {
      await verify(blob);

      afsBlob = blob;

      busy(
        'Saving',
        'Storing the combined disc data in this browser...'
      );

      await dbPut(blob);

      showReady();
    } catch (e) {
      afsBlob = null;

      console.error(
        '[3SX Loader] AFS verification failed:',
        e
      );

      setError(e.message || 'Could not prepare SF33RD.AFS.');

      busy(
        'Error',
        'The disc data could not be prepared.'
      );
    }
  }

  function showReady() {
    show('busy', false);
    show('need-file', false);
    show('ready', true);

    const readyText = $('ready-text');

    if (readyText && !readyText.textContent.trim()) {
      readyText.textContent =
        'The combined SF33RD.AFS data is ready.';
    }

    const play = $('play');

    if (play) {
      play.focus();
    }
  }

  function syncFs(FS, populate) {
    return new Promise(resolve => {
      FS.syncfs(populate, err => {
        if (err) {
          console.warn(
            '[3SX Loader] IDBFS sync failed:',
            err
          );
        }

        resolve();
      });
    });
  }

  /*
   * Loads:
   *
   * SF33RD.AFS.part000
   * SF33RD.AFS.part001
   * ...
   * SF33RD.AFS.part030
   *
   * 31 parts total.
   *
   * The parts are combined into one Blob.
   */

  async function loadSplitAFS() {
    const parts = [];

    for (let i = 0; i < PART_COUNT; i++) {
      const name =
        `${PART_PREFIX}${String(i).padStart(3, '0')}`;

      busy(
        'Loading disc data',
        `Loading part ${i + 1} / ${PART_COUNT}: ${name}`,
        i / PART_COUNT
      );

      let response;

      try {
        response = await fetch(name, {
          cache: 'no-cache'
        });
      } catch (e) {
        throw new Error(
          `Could not load ${name}. Make sure all 31 SF33RD.AFS parts are uploaded next to index.html.`
        );
      }

      if (!response.ok) {
        throw new Error(
          `Could not load ${name} (HTTP ${response.status}). Make sure all 31 parts exist.`
        );
      }

      const buffer =
        await response.arrayBuffer();

      if (!buffer.byteLength) {
        throw new Error(
          `${name} is empty.`
        );
      }

      parts.push(buffer);

      busy(
        'Loading disc data',
        `Loaded part ${i + 1} / ${PART_COUNT} (${(
          buffer.byteLength /
          1024 /
          1024
        ).toFixed(2)} MiB)`,
        (i + 1) / PART_COUNT
      );
    }

    busy(
      'Combining disc data',
      'Combining all 31 parts into SF33RD.AFS...'
    );

    const blob = new Blob(parts, {
      type: 'application/octet-stream'
    });

    console.log(
      `[3SX Loader] Combined ${PART_COUNT} parts into SF33RD.AFS (${blob.size.toLocaleString()} bytes).`
    );

    return blob;
  }

  async function start() {
    if (started || !afsBlob) {
      return;
    }

    started = true;

    busy(
      'Loading',
      'Reading combined disc data into memory...'
    );

    const data =
      new Uint8Array(
        await afsBlob.arrayBuffer()
      );

    busy(
      'Loading',
      'Starting the game...'
    );

    const canvas = $('canvas');

    if (!canvas) {
      throw new Error(
        '3SX canvas was not found.'
      );
    }

    document.body.classList.add(
      'playing'
    );

    const moduleConfig = {
      canvas,

      noInitialRun: true,

      print: t =>
        console.log(t),

      printErr: t =>
        console.warn(t),

      locateFile: f => f,

      preRun: [
        mod => {
          const FS = mod.FS;

          try {
            FS.mkdir('/libsdl');
          } catch (e) {}

          FS.mount(
            mod.IDBFS,
            {},
            '/libsdl'
          );

          mod.addRunDependency(
            'idbfs'
          );

          FS.syncfs(
            true,
            err => {
              if (err) {
                console.warn(
                  '[3SX Loader] IDBFS load failed:',
                  err
                );
              }

              mod.removeRunDependency(
                'idbfs'
              );
            }
          );

          try {
            FS.mkdir('/afs');
          } catch (e) {}

          FS.writeFile(
            '/afs/SF33RD.AFS',
            data,
            {
              canOwn: true
            }
          );

          console.log(
            '[3SX Loader] SF33RD.AFS mounted at /afs/SF33RD.AFS'
          );
        }
      ]
    };

    const mod =
      await create3SX(moduleConfig);

    const FS = mod.FS;

    const mkdirp = p => {
      let cur = '';

      for (
        const part of p
          .split('/')
          .filter(Boolean)
      ) {
        cur += '/' + part;

        try {
          FS.mkdir(cur);
        } catch (e) {}
      }
    };

    mkdirp(PREF);

    await syncFs(
      FS,
      false
    );

    setInterval(
      () => syncFs(
        FS,
        false
      ),
      5000
    );

    window.addEventListener(
      'pagehide',
      () => syncFs(
        FS,
        false
      )
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          syncFs(
            FS,
            false
          );
        }
      }
    );

    window.__3sx = mod;

    try {
      mod.callMain([]);
    } catch (e) {
      if (
        e &&
        e.name !== 'ExitStatus' &&
        e !== 'unwind'
      ) {
        throw e;
      }
    }

    canvas.focus();
  }

  /*
   * Only the FIGHT! button remains.
   *
   * There is no manual file picker and
   * no "use a different file" button.
   */

  const play = $('play');

  if (play) {
    play.addEventListener(
      'click',
      start
    );
  }

  /*
   * Allow Enter to start once the
   * combined AFS is ready.
   */

  window.addEventListener(
    'keydown',
    e => {
      if (
        !started &&
        e.key === 'Enter' &&
        $('ready') &&
        !$('ready').hidden
      ) {
        e.preventDefault();
        start();
      }
    }
  );

  async function init() {
    /*
     * Load the Emscripten module.
     */

    const script =
      document.createElement('script');

    script.src = 'https://cdn.jsdelivr.net/gh/linkawaken1979-alt/3sx-web@main/3sx.js';

    document.head.appendChild(
      script
    );

    busy(
      'Loading',
      'Looking for your disc data...'
    );

    /*
     * First check IndexedDB.
     *
     * If the 31 parts were already combined
     * during a previous visit, use the cached
     * combined SF33RD.AFS instead.
     */

    const cached =
      await dbGet();

    if (cached) {
      try {
        busy(
          'Checking file',
          'Checking the saved SF33RD.AFS...'
        );

        await verify(
          cached
        );

        afsBlob = cached;

        const readyText =
          $('ready-text');

        if (readyText) {
          readyText.textContent =
            'Using the SF33RD.AFS saved in this browser.';
        }

        console.log(
          '[3SX Loader] Using cached SF33RD.AFS.'
        );

        showReady();

        return;
      } catch (e) {
        console.warn(
          '[3SX Loader] Cached AFS is invalid:',
          e
        );
      }
    }

    /*
     * No valid cached file.
     *
     * Load and combine the 31 split parts.
     */

    try {
      const blob =
        await loadSplitAFS();

      await accept(
        blob
      );

      return;
    } catch (e) {
      console.error(
        '[3SX Loader] Split AFS loading failed:',
        e
      );

      setError(
        e.message ||
        'Could not prepare the disc data.'
      );

      busy(
        'Error',
        'Could not combine the 31 SF33RD.AFS parts.'
      );
    }
  }

  init();

})();