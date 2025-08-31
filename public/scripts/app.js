const logContainer = document.getElementById('debug-log');
function logToUI(message) {
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(logEntry);
    // Scroll to the bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

logToUI('APP: Script loaded.');

// Register Service Worker
if ('serviceWorker' in navigator) {
    logToUI('APP: Service Worker is supported.');
    window.addEventListener('load', () => {
        logToUI('APP: Page loaded. Registering Service Worker...');
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                logToUI(`APP: Service Worker registered successfully. Scope: ${registration.scope}`);
            })
            .catch(error => {
                logToUI(`APP: Service Worker registration FAILED: ${error}`);
            });
    });

    // Listen for messages from the Service Worker
    logToUI('APP: Adding message listener.');
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type) {
            if (event.data.type === 'LOG') {
                logToUI(event.data.message);
            } else if (event.data.type === 'SHARE_SUCCESS') {
                logToUI('APP: Received SHARE_SUCCESS message.');
                displaySharedFiles();
            }
        }
    });
} else {
    logToUI('APP: Service Worker is NOT supported.');
}

document.addEventListener('DOMContentLoaded', () => {
    logToUI('APP: DOMContentLoaded event fired.');
    const redirectButton = document.getElementById('redirect-button');
    const shareDialog = document.getElementById('share-dialog');
    const closeDialogButton = document.getElementById('close-dialog-button');

    redirectButton.addEventListener('click', () => {
        logToUI('APP: Redirect button clicked.');
        window.location.href = 'http://192.168.1.10:500';
    });

    closeDialogButton.addEventListener('click', () => {
        logToUI('APP: Close dialog button clicked.');
        shareDialog.classList.add('hidden');
    });
});

function displaySharedFiles() {
    logToUI('APP: displaySharedFiles() called.');
    const shareDialog = document.getElementById('share-dialog');
    const fileNameElement = document.getElementById('file-name');

    const dbOpenRequest = indexedDB.open('pairdrop_store');

    dbOpenRequest.onsuccess = (e) => {
        logToUI('APP: IndexedDB opened successfully.');
        const db = e.target.result;
        const transaction = db.transaction('share_target_files', 'readonly');
        const objectStore = transaction.objectStore('share_target_files');
        const getAllRequest = objectStore.getAll();

        getAllRequest.onsuccess = (event) => {
            const files = event.target.result;
            logToUI(`APP: Found ${files ? files.length : 0} file(s) in IndexedDB.`);
            if (files && files.length > 0) {
                const fileNames = files.map(file => file.name).join(', ');
                fileNameElement.textContent = fileNames;
                shareDialog.classList.remove('hidden');
                logToUI(`APP: Displaying dialog for: ${fileNames}`);
                showNotification(fileNames);
                clearSharedFiles(db);
            }
        };
        getAllRequest.onerror = (err) => {
            logToUI(`APP: Error getting files from IndexedDB: ${err.target.error}`);
        };
    };

    dbOpenRequest.onerror = (e) => {
        logToUI(`APP: Error opening IndexedDB: ${e.target.error}`);
    };
}

function clearSharedFiles(db) {
    logToUI('APP: clearSharedFiles() called.');
    const transaction = db.transaction('share_target_files', 'readwrite');
    const objectStore = transaction.objectStore('share_target_files');
    const clearRequest = objectStore.clear();

    clearRequest.onsuccess = () => {
        logToUI('APP: Cleared files from IndexedDB.');
    };
    clearRequest.onerror = (e) => {
        logToUI(`APP: Error clearing files from IndexedDB: ${e.target.error}`);
    };
}

function showNotification(fileNames) {
    logToUI('APP: showNotification() called.');
    if (!('Notification' in window)) {
        logToUI('APP: Notifications not supported.');
        return;
    }

    Notification.requestPermission().then(permission => {
        logToUI(`APP: Notification permission is ${permission}.`);
        if (permission === 'granted') {
            const notification = new Notification('File Received!', {
                body: `You received: ${fileNames}`,
                icon: '/images/favicon-96x96-notification.png'
            });
        }
    });
}
