/**
 * ALTIRO FINTECH — Secure Token Economy
 * Frontend: Vanilla JS + Tailwind + Firebase Compat CDN
 */

// ==================== YOUR FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyCoy8pE7EoJYFc7yuxKvguai9XWda0fyS8",
    authDomain: "altiro-fintech.firebaseapp.com",
    projectId: "altiro-fintech",
    storageBucket: "altiro-fintech.firebasestorage.app",
    messagingSenderId: "873641849725",
    appId: "1:873641849725:web:e8c05cb8019fa6b5acd214"
};

// ==================== INITIALIZATION ====================
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();

const processTransaction = functions.httpsCallable('processTransaction');

// ==================== STATE ====================
let currentUser = null;
let isAdmin = false;
let userData = null;
let unsubscribers = [];
let ADMIN_UID = null;

// ==================== DOM REFERENCES ====================
const views = {
    auth: document.getElementById('authView'),
    bank: document.getElementById('bankView'),
    client: document.getElementById('clientView')
};
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toastContainer = document.getElementById('toastContainer');

// ==================== ADMIN CONFIG LOADER ====================
async function loadAdminConfig() {
    try {
        const doc = await db.collection('config').doc('app').get();
        if (doc.exists && doc.data().adminUid) {
            ADMIN_UID = doc.data().adminUid;
        }
    } catch (e) {
        console.log('Admin config not yet set');
    }
}

// ==================== AUTHENTICATION ====================
function switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (tab === 'login') {
        loginTab.classList.add('bg-white/20', 'shadow-sm');
        loginTab.classList.remove('hover:bg-white/10');
        registerTab.classList.remove('bg-white/20', 'shadow-sm');
        registerTab.classList.add('hover:bg-white/10');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        registerTab.classList.add('bg-white/20', 'shadow-sm');
        registerTab.classList.remove('hover:bg-white/10');
        loginTab.classList.remove('bg-white/20', 'shadow-sm');
        loginTab.classList.add('hover:bg-white/10');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    setLoading(true, 'Signing in...');
    toggleBtnSpinner('loginBtnText', 'loginSpinner', true);
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Welcome back!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(false);
        toggleBtnSpinner('loginBtnText', 'loginSpinner', false);
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    setLoading(true, 'Creating account...');
    toggleBtnSpinner('registerBtnText', 'registerSpinner', true);
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            email: email,
            displayName: name,
            role: 'client',
            balance: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Account created successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(false);
        toggleBtnSpinner('registerBtnText', 'registerSpinner', false);
    }
});

async function logout() {
    setLoading(true, 'Signing out...');
    try {
        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];
        await auth.signOut();
        showToast('Signed out', 'info');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(false);
    }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadAdminConfig();
        isAdmin = ADMIN_UID && user.uid === ADMIN_UID;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
        } else if (isAdmin) {
            userData = {
                uid: user.uid,
                email: user.email,
                displayName: 'Bank Administrator',
                role: 'admin',
                balance: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(user.uid).set(userData);
        }
        showView(isAdmin ? 'bank' : 'client');
        if (isAdmin) initBankDashboard();
        else initClientDashboard();
    } else {
        currentUser = null;
        isAdmin = false;
        userData = null;
        ADMIN_UID = null;
        unsubscribers.forEach(unsub => unsub());
        unsubscribers = [];
        showView('auth');
    }
});

// ==================== VIEW MANAGEMENT ====================
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-500/80 border-emerald-400/50',
        error: 'bg-red-500/80 border-red-400/50',
        info: 'bg-blue-500/80 border-blue-400/50',
        warning: 'bg-amber-500/80 border-amber-400/50'
    };
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-md shadow-lg flex items-center gap-3 min-w-[280px] toast-enter`;
    toast.innerHTML = `<span class="text-lg">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span><span class="text-sm font-medium">${message}</span>`;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-enter-active');
    });
    setTimeout(() => {
        toast.classList.remove('toast-enter-active');
        toast.classList.add('toast-exit-active');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== LOADING & UTILS ====================
function setLoading(show, text = 'Processing...') {
    loadingText.textContent = text;
    loadingOverlay.classList.toggle('hidden', !show);
}
function toggleBtnSpinner(textId, spinnerId, show) {
    document.getElementById(textId).classList.toggle('hidden', show);
    document.getElementById(spinnerId).classList.toggle('hidden', !show);
}
function formatDate(ts) {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
}
function truncateHash(hash) {
    if (!hash) return '-';
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 8);
}

// ==================== BANK DASHBOARD ====================
function initBankDashboard() {
    document.getElementById('bankUserEmail').textContent = currentUser.email;
    const unsubUsers = db.collection('users').onSnapshot(snapshot => {
        const users = [];
        let total = 0;
        const select = document.getElementById('mintTarget');
        select.innerHTML = '<option value="" class="text-black">Select Client...</option>';
        snapshot.forEach(doc => {
            const u = doc.data();
            users.push(u);
            total += u.balance || 0;
            if (u.role !== 'admin') {
                const opt = document.createElement('option');
                opt.value = u.uid;
                opt.textContent = `${u.displayName || u.email} (${u.balance || 0})`;
                opt.className = 'text-black';
                select.appendChild(opt);
            }
        });
        document.getElementById('totalTokens').textContent = total.toLocaleString();
        const tbody = document.getElementById('userBalancesTable');
        tbody.innerHTML = users.map(u => `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="py-3 pl-2">${u.displayName || 'Unknown'}</td>
                <td class="py-3 text-white/70">${u.email}</td>
                <td class="py-3 text-right pr-2 font-mono font-semibold">${u.balance || 0}</td>
            </tr>
        `).join('');
    });
    unsubscribers.push(unsubUsers);

    const unsubRequests = db.collection('pending_requests')
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            const container = document.getElementById('pendingRequestsList');
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-white/40 text-sm italic">No pending requests</p>';
                return;
            }
            container.innerHTML = snapshot.docs.map(doc => {
                const r = doc.data();
                return `
                    <div class="glass rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                            <p class="font-medium text-sm">${r.type === 'token_request' ? '📥 Token Request' : '💵 Cash Out'}</p>
                            <p class="text-xs text-white/60">User: ${r.userId} | Amount: ${r.amount}</p>
                            ${r.reason ? `<p class="text-xs text-white/40 mt-1">"${r.reason}"</p>` : ''}
                            ${r.method ? `<p class="text-xs text-white/40 mt-1">Method: ${r.method}</p>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="handleRequest('${doc.id}', 'approved')" class="px-3 py-1.5 rounded-lg bg-green-500/30 hover:bg-green-500/50 border border-green-400/30 text-xs font-medium transition-all">Approve</button>
                            <button onclick="handleRequest('${doc.id}', 'denied')" class="px-3 py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 border border-red-400/30 text-xs font-medium transition-all">Deny</button>
                        </div>
                    </div>
                `;
            }).join('');
        });
    unsubscribers.push(unsubRequests);

    const unsubLedger = db.collection('ledger')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot(snapshot => {
            const tbody = document.getElementById('ledgerTable');
            tbody.innerHTML = snapshot.docs.map(doc => {
                const tx = doc.data();
                return `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-2 pl-2 text-white/50">${formatDate(tx.timestamp)}</td>
                        <td class="py-2"><span class="px-2 py-0.5 rounded-full text-xs ${tx.type === 'mint' ? 'bg-green-500/20' : tx.type === 'transfer' ? 'bg-blue-500/20' : tx.type === 'cash_out' ? 'bg-orange-500/20' : 'bg-purple-500/20'}">${tx.type}</span></td>
                        <td class="py-2 text-white/70">${tx.senderId === 'BANK' ? '🏦 BANK' : truncateHash(tx.senderId)} → ${tx.receiverId === 'BANK' ? '🏦 BANK' : truncateHash(tx.receiverId)}</td>
                        <td class="py-2 text-right font-semibold">${tx.amount}</td>
                        <td class="py-2 pr-2 text-white/40" title="${tx.currentHash}">${truncateHash(tx.currentHash)}</td>
                    </tr>
                `;
            }).join('');
        });
    unsubscribers.push(unsubLedger);

    document.getElementById('mintForm').onsubmit = async (e) => {
        e.preventDefault();
        const target = document.getElementById('mintTarget').value;
        const amount = parseInt(document.getElementById('mintAmount').value);
        if (!target) return showToast('Select a client', 'warning');
        toggleBtnSpinner('mintBtnText', 'mintSpinner', true);
        setLoading(true, 'Minting tokens...');
        try {
            const result = await processTransaction({ type: 'mint', payload: { targetUid: target, amount } });
            showToast(result.data.message || 'Tokens minted!', 'success');
            document.getElementById('mintForm').reset();
        } catch (err) {
            showToast(err.message || 'Minting failed', 'error');
        } finally {
            toggleBtnSpinner('mintBtnText', 'mintSpinner', false);
            setLoading(false);
        }
    };
}

async function handleRequest(requestId, decision) {
    setLoading(true, decision === 'approved' ? 'Approving...' : 'Denying...');
    try {
        const result = await processTransaction({ type: 'approve_request', payload: { requestId, decision } });
        showToast(result.data.message || `Request ${decision}`, 'success');
    } catch (err) {
        showToast(err.message || 'Failed to process request', 'error');
    } finally {
        setLoading(false);
    }
}

// ==================== CLIENT DASHBOARD ====================
function initClientDashboard() {
    document.getElementById('clientUserName').textContent = userData?.displayName || currentUser.email;
    const unsubUser = db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        if (doc.exists) {
            document.getElementById('clientBalance').textContent = (doc.data().balance || 0).toLocaleString();
        }
    });
    unsubscribers.push(unsubUser);

    const unsubHistory = db.collection('ledger')
        .where('involvedUsers', 'array-contains', currentUser.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
            const container = document.getElementById('clientHistory');
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-white/40 text-sm italic">No transactions yet</p>';
                return;
            }
            container.innerHTML = snapshot.docs.map(doc => {
                const tx = doc.data();
                const isSender = tx.senderId === currentUser.uid;
                let icon = '💸', color = 'text-white', sign = '';
                if (tx.type === 'mint') { icon = '💰'; color = 'text-green-400'; sign = '+'; }
                else if (tx.type === 'cash_out') { icon = '💵'; color = 'text-orange-400'; sign = '-'; }
                else if (isSender) { icon = '📤'; color = 'text-red-400'; sign = '-'; }
                else { icon = '📥'; color = 'text-blue-400'; sign = '+'; }
                return `
                    <div class="glass rounded-xl p-3 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="text-lg">${icon}</span>
                            <div>
                                <p class="text-sm font-medium">${tx.type === 'transfer' ? (isSender ? 'Sent to' : 'Received from') : tx.type}</p>
                                <p class="text-xs text-white/50">${formatDate(tx.timestamp)}</p>
                            </div>
                        </div>
                        <span class="font-mono font-bold ${color}">${sign}${tx.amount}</span>
                    </div>
                `;
            }).join('');
        });
    unsubscribers.push(unsubHistory);

    document.getElementById('sendForm').onsubmit = async (e) => {
        e.preventDefault();
        const recipient = document.getElementById('sendRecipient').value.trim();
        const amount = parseInt(document.getElementById('sendAmount').value);
        toggleBtnSpinner('sendBtnText', 'sendSpinner', true);
        setLoading(true, 'Processing transfer...');
        try {
            const result = await processTransaction({ type: 'transfer', payload: { receiverId: recipient, amount } });
            showToast(result.data.message || 'Transfer complete!', 'success');
            closeModal('sendModal');
            document.getElementById('sendForm').reset();
        } catch (err) {
            showToast(err.message || 'Transfer failed', 'error');
        } finally {
            toggleBtnSpinner('sendBtnText', 'sendSpinner', false);
            setLoading(false);
        }
    };

    document.getElementById('requestForm').onsubmit = async (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('requestAmount').value);
        const reason = document.getElementById('requestReason').value;
        toggleBtnSpinner('requestBtnText', 'requestSpinner', true);
        setLoading(true, 'Submitting request...');
        try {
            await db.collection('pending_requests').add({
                userId: currentUser.uid,
                userEmail: currentUser.email,
                type: 'token_request',
                amount, reason,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Token request submitted!', 'success');
            closeModal('requestModal');
            document.getElementById('requestForm').reset();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            toggleBtnSpinner('requestBtnText', 'requestSpinner', false);
            setLoading(false);
        }
    };

    document.getElementById('cashOutForm').onsubmit = async (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('cashOutAmount').value);
        const method = document.getElementById('cashOutMethod').value;
        toggleBtnSpinner('cashOutBtnText', 'cashOutSpinner', true);
        setLoading(true, 'Submitting cash out...');
        try {
            await db.collection('pending_requests').add({
                userId: currentUser.uid,
                userEmail: currentUser.email,
                type: 'cash_out',
                amount, method,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Cash out request submitted!', 'success');
            closeModal('cashOutModal');
            document.getElementById('cashOutForm').reset();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            toggleBtnSpinner('cashOutBtnText', 'cashOutSpinner', false);
            setLoading(false);
        }
    };
}

// ==================== QR WALLET ====================
let qrCodeInstance = null;
function showQRWallet() {
    const modal = document.getElementById('qrWalletModal');
    const container = document.getElementById('qrCodeContainer');
    const uidDisplay = document.getElementById('qrWalletUid');
    container.innerHTML = '';
    uidDisplay.textContent = currentUser.uid;
    const payload = JSON.stringify({ app: "altiro-fintech", uid: currentUser.uid });
    qrCodeInstance = new QRCode(container, {
        text: payload, width: 200, height: 200,
        colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H
    });
    modal.classList.remove('hidden');
}

// ==================== QR SCANNER ====================
let html5QrCode = null;
function showQRScanner() {
    const modal = document.getElementById('qrScannerModal');
    modal.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("qrScannerContainer");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            try {
                const data = JSON.parse(decodedText);
                if (data.app === "altiro-fintech" && data.uid) {
                    stopQRScanner();
                    document.getElementById('sendRecipient').value = data.uid;
                    showSendModal();
                    showToast('QR scanned! Recipient filled.', 'success');
                } else {
                    showToast('Invalid QR format', 'error');
                }
            } catch (e) {
                showToast('Invalid QR data', 'error');
            }
        },
        () => {}
    ).catch(err => {
        showToast('Camera access denied or unavailable', 'error');
        stopQRScanner();
    });
}
function stopQRScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => { html5QrCode.clear(); html5QrCode = null; }).catch(() => {});
    }
    document.getElementById('qrScannerModal').classList.add('hidden');
}

// ==================== MODAL UTILS ====================
function showSendModal() { document.getElementById('sendModal').classList.remove('hidden'); }
function showRequestModal() { document.getElementById('requestModal').classList.remove('hidden'); }
function showCashOutModal() { document.getElementById('cashOutModal').classList.remove('hidden'); }
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

['sendModal', 'requestModal', 'cashOutModal', 'qrWalletModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal(id);
    });
});
