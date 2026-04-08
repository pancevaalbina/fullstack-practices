const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const socket = io('http://localhost:3001');

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
    try {
        const response = await fetch(`/content/${page}.html`);
        const html = await response.text();
        contentDiv.innerHTML = html;
        if (page === 'home') {
            initNotes();
        }
    } catch (err) {
        contentDiv.innerHTML = '<p class="text-error">Ошибка загрузки.</p>';
    }
}

homeBtn.addEventListener('click', () => { setActiveButton('home-btn'); loadContent('home'); });
aboutBtn.addEventListener('click', () => { setActiveButton('about-btn'); loadContent('about'); });

loadContent('home');

function initNotes() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const list = document.getElementById('notes-list');

    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        list.innerHTML = notes.map(note => `<li class="card" style="margin-bottom: 0.5rem; padding: 0.5rem;">${note}</li>`).join('');
    }

    function addNote(text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.push(text);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        socket.emit('newTask', { text, timestamp: Date.now() });
    }
    
    socket.on('taskAdded', (task) => {
        const notification = document.createElement('div');
        notification.textContent = `Новая задача: ${task.text}`;
        notification.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #4285f4; color: white; padding: 1rem; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text) addNote(text);
        input.value = '';
    });

    loadNotes();
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const enableBtn = document.getElementById('enable-push');
        const disableBtn = document.getElementById('disable-push');

        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            enableBtn.style.display = 'none';
            disableBtn.style.display = 'inline-block';
        }

        enableBtn.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array('BBpZ9c4ygY4uV9Pzv4K7ns6AbmtnTjAs9L8dHc0UHAjX8cYltnTWpZqkpu0PlOndrzU0nVaD_csl8_gpYCbV4y8')
                });
                await fetch('http://localhost:3001/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                });
                enableBtn.style.display = 'none';
                disableBtn.style.display = 'inline-block';
            }
        });

        disableBtn.addEventListener('click', async () => {
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) {
                await fetch('http://localhost:3001/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });
                await subscription.unsubscribe();
                disableBtn.style.display = 'none';
                enableBtn.style.display = 'inline-block';
            }
        });
    });
}
