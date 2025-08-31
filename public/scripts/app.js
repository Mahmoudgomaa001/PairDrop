document.addEventListener('DOMContentLoaded', () => {
    const redirectButton = document.getElementById('redirect-button');
    const shareDialog = document.getElementById('share-dialog');
    const fileNameElement = document.getElementById('file-name');
    const closeDialogButton = document.getElementById('close-dialog-button');

    // 1. Redirect button logic
    redirectButton.addEventListener('click', () => {
        window.location.href = 'http://192.168.1.10:5000';
    });

    // 2. Close dialog button logic
    closeDialogButton.addEventListener('click', () => {
        shareDialog.classList.add('hidden');
    });

    // 3. Check for share target query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('share_target')) {
        displaySharedFiles();
    }

    function displaySharedFiles() {
        const dbOpenRequest = indexedDB.open('pairdrop_store');

        dbOpenRequest.onsuccess = (e) => {
            const db = e.target.result;
            const transaction = db.transaction('share_target_files', 'readonly');
            const objectStore = transaction.objectStore('share_target_files');
            const getAllRequest = objectStore.getAll();

            getAllRequest.onsuccess = (event) => {
                const files = event.target.result;
                if (files && files.length > 0) {
                    const fileNames = files.map(file => file.name).join(', ');
                    fileNameElement.textContent = fileNames;
                    shareDialog.classList.remove('hidden');
                    clearSharedFiles(db);
                }
            };
        };

        dbOpenRequest.onerror = (e) => {
            console.error('Error opening IndexedDB:', e);
        };
    }

    function clearSharedFiles(db) {
        const transaction = db.transaction('share_target_files', 'readwrite');
        const objectStore = transaction.objectStore('share_target_files');
        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => {
            console.log('Shared files cleared from IndexedDB.');
        };
        clearRequest.onerror = (e) => {
            console.error('Error clearing shared files from IndexedDB:', e);
        };
    }
});
