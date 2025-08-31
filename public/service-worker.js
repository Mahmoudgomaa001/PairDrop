const cacheVersion = 'v1.11.2-minimal-debug';
const cacheTitle = `pairdrop-cache-${cacheVersion}`;
const relativePathsToCache = [
    './',
    'index.html',
    'manifest.json',
    'styles/styles-main.css',
    'scripts/app.js',
    'images/favicon-96x96.png',
    'images/android-chrome-192x192.png',
    'images/android-chrome-192x192-maskable.png',
    'images/android-chrome-512x512.png',
    'images/android-chrome-512x512-maskable.png',
    'images/apple-touch-icon.png'
];
const relativePathsNotToCache = [
    'config'
]

const postMessageToClients = async (message) => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(client => {
        client.postMessage(message);
    });
};

self.addEventListener('install', function(event) {
    postMessageToClients({ type: 'LOG', message: 'SW: Install event received.' });
    event.waitUntil(
        caches.open(cacheTitle)
            .then(function(cache) {
                postMessageToClients({ type: 'LOG', message: 'SW: Caching core files.' });
                return cache
                    .addAll(relativePathsToCache)
                    .then(_ => {
                        postMessageToClients({ type: 'LOG', message: 'SW: Core files cached. Skipping wait.' });
                        self.skipWaiting();
                    });
            })
    );
});

self.addEventListener('activate', evt => {
    postMessageToClients({ type: 'LOG', message: `SW: Activate event received. Version: ${cacheVersion}` });
    evt.waitUntil(clients.claim());
    return evt.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== cacheTitle) {
                            postMessageToClients({ type: 'LOG', message: `SW: Deleting old cache: ${cacheName}` });
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    )
});


self.addEventListener('fetch', function(event) {
    if (event.request.method === "POST") {
        postMessageToClients({ type: 'LOG', message: 'SW: POST request intercepted.' });
        event.respondWith(
            evaluateRequestData(event.request).then(() => {
                postMessageToClients({ type: 'LOG', message: 'SW: POST request evaluation finished.' });
                return new Response(null, { status: 200, statusText: "OK" });
            }).catch(err => {
                postMessageToClients({ type: 'LOG', message: `SW: POST evaluation error: ${err}` });
                return new Response(null, { status: 500, statusText: "Share processing failed" });
            })
        );
    } else {
        // Basic cache-first for GET requests. Not logging for brevity.
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
        );
    }
});

const evaluateRequestData = async function (request) {
    await postMessageToClients({ type: 'LOG', message: 'SW: Evaluating request data.' });
    const formData = await request.formData();
    const files = formData.getAll("allfiles");

    if (!files || files.length === 0) {
        await postMessageToClients({ type: 'LOG', message: 'SW: No files found in POST request.' });
        return Promise.resolve();
    }

    await postMessageToClients({ type: 'LOG', message: `SW: Found ${files.length} file(s). Preparing to save.` });

    const fileObjects = await Promise.all(files.map(async file => ({
        name: file.name,
        buffer: await file.arrayBuffer()
    })));

    return new Promise((resolve, reject) => {
        const DBOpenRequest = indexedDB.open('pairdrop_store');

        DBOpenRequest.onerror = (event) => {
            postMessageToClients({ type: 'LOG', message: `SW: IndexedDB error: ${event.target.error}` });
            reject(`IndexedDB error: ${event.target.error}`);
        };

        DBOpenRequest.onsuccess = (event) => {
            postMessageToClients({ type: 'LOG', message: 'SW: IndexedDB opened successfully.' });
            const db = event.target.result;
            const transaction = db.transaction('share_target_files', 'readwrite');
            const objectStore = transaction.objectStore('share_target_files');

            const addPromises = fileObjects.map(file => {
                return new Promise((resolveAdd, rejectAdd) => {
                    const request = objectStore.add(file);
                    request.onsuccess = () => {
                        postMessageToClients({ type: 'LOG', message: `SW: Saved ${file.name} to IndexedDB.` });
                        resolveAdd();
                    };
                    request.onerror = (e) => {
                        postMessageToClients({ type: 'LOG', message: `SW: Failed to save ${file.name}: ${e.target.error}` });
                        rejectAdd(`Failed to save ${file.name}`);
                    };
                });
            });

            Promise.all(addPromises)
                .then(async () => {
                    await postMessageToClients({ type: 'LOG', message: 'SW: All files saved. Sending SHARE_SUCCESS message.' });
                    await postMessageToClients({ type: 'SHARE_SUCCESS' });
                    resolve();
                })
                .catch(error => {
                    postMessageToClients({ type: 'LOG', message: `SW: Error saving one or more files: ${error}` });
                    reject(error);
                });
        };
    });
};
