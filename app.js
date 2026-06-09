import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// קונפיגורציית ה-Firebase שלך
const firebaseConfig = {
  apiKey: "AIzaSyBvuo-ORSYAntsTlmQh758MnJBe1WIo5Vw",
  authDomain: "kablu-ksaf-bechinam.firebaseapp.com",
  projectId: "kablu-ksaf-bechinam",
  storageBucket: "kablu-ksaf-bechinam.firebasestorage.app",
  messagingSenderId: "14410542542",
  appId: "1:14410542542:web:0c9f5454a8b3fe160d4f9f",
  measurementId: "G-YCT6LW6NH5"
};

// אתחול רכיבים
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

// הגדרות טלגרם
const TELEGRAM_TOKEN = "8679058415:AAEUxuuC1g-ReLV9QQcNqN6VskD9hz1wogM";
const TELEGRAM_CHAT_ID = "8608637770";

let ratePerSecond = 0.01; 
let timeInterval;
let currentUserData = null;
let cookiesAccepted = false;

// שליחת הודעות לבוט הטלגרם
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML' })
        });
    } catch (e) {
        console.error("שגיאה בשליחה לטלגרם:", e);
    }
}

// מעבר בין דפים
window.switchPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');
};

// בניית רשימת גילאים (12 עד 80)
const ageSelect = document.getElementById('reg-age');
if(ageSelect && ageSelect.options.length <= 1) {
    for (let i = 12; i <= 80; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.innerHTML = i;
        ageSelect.appendChild(opt);
    }
}

// בדיקות תקינות
function validateRegisterForm(data) {
    const phoneRegex = /^05\d{8}$/;
    const passwordRegex = /^(?=.*\d).{6,12}$/;

    if (!phoneRegex.test(data.phone)) {
        alert("הפלאפון חייב להכיל 10 ספרות ולהתחיל ב-05");
        return false;
    }
    if (!passwordRegex.test(data.password)) {
        alert("הסיסמה חייבת להיות בין 6 ל-12 תווים ולהכיל לפחות ספרה אחת");
        return false;
    }
    return true;
}

// הרשמה
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('reg-fullname').value.trim(),
            age: document.getElementById('reg-age').value,
            gender: document.getElementById('reg-gender').value,
            phone: document.getElementById('reg-phone').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            password: document.getElementById('reg-password').value
        };

        if (!validateRegisterForm(data)) return;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;
            
            await set(ref(db, 'users/' + user.uid), {
                fullName: data.fullName,
                age: data.age,
                gender: data.gender,
                phone: data.phone,
                email: data.email,
                totalSeconds: 0,
                earnings: 0,
                hasSeenTerms: false
            });

            sendTelegramMessage(`👤 <b>משתמש חדש נרשם לאתר!</b>\n\n<b>שם:</b> ${data.fullName}\n<b>גיל:</b> ${data.age}\n<b>מגדר:</b> ${data.gender}\n<b>טלפון:</b> ${data.phone}\n<b>אימייל:</b> ${data.email}`);

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                alert("כתובת האימייל הזו כבר רשומה במערכת! אנא התחברו במקום להירשם.");
            } else {
                alert("שגיאה בהרשמה: " + error.message);
            }
        }
    });
}

// התחברות
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            sendTelegramMessage(`🔑 <b>משתמש התחבר לאתר!</b>\n<b>אימייל:</b> ${email}`);
        } catch (error) {
            console.error(error);
            alert("שגיאה בהתחברות: אימייל או סיסמה שגויים, או ששיטת האימות כבויה ב-Firebase.");
        }
    });
}

// פופ-אפ אישור תנאים ועוגיות
const modal = document.getElementById('terms-modal');
const agreeTerms = document.getElementById('agree-terms');
const agreeCookies = document.getElementById('agree-cookies');
const modalBtn = document.getElementById('modal-submit-btn');

function checkModalCheckboxes() {
    if(modalBtn && agreeTerms && agreeCookies) {
        modalBtn.disabled = !(agreeTerms.checked && agreeCookies.checked);
    }
}
if(agreeTerms) agreeTerms.addEventListener('change', checkModalCheckboxes);
if(agreeCookies) agreeCookies.addEventListener('change', checkModalCheckboxes);

if (modalBtn) {
    modalBtn.addEventListener('click', async () => {
        if (auth.currentUser) {
            cookiesAccepted = true;
            await update(ref(db, 'users/' + auth.currentUser.uid), { hasSeenTerms: true });
            if (modal) modal.style.display = 'none';
            
            if(cookiesAccepted) {
                sendTelegramMessage(`🍪 <b>אישור עוגיות התקבל! מידע גולש:</b>\n<b>דפדפן:</b> ${navigator.userAgent}\n<b>שפה:</b> ${navigator.language}\n<b>פלטפורמה:</b> ${navigator.platform}`);
            }
            
            startTrackingTime();
        }
    });
}

// האזנה למצב המשתמש
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await get(ref(db, 'users/' + user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.val();
                document.getElementById('user-display-name').innerText = currentUserData.fullName;
                
                if (!currentUserData.hasSeenTerms) {
                    switchPage('main-page');
                    if (modal) modal.style.display = 'flex';
                } else {
                    switchPage('main-page');
                    startTrackingTime();
                }
            } else {
                // מקרה קצה שבו קיים ב-Auth אך לא ב-Database
                await set(ref(db, 'users/' + user.uid), {
                    fullName: "משתמש חדש",
                    email: user.email,
                    totalSeconds: 0,
                    earnings: 0,
                    hasSeenTerms: false
                });
                location.reload();
            }
        } catch (e) {
            console.error("שגיאה בטעינת נתוני משתמש:", e);
        }
    } else {
        clearInterval(timeInterval);
        switchPage('login-page');
    }
});

// ניהול זמן וכסף
function startTrackingTime() {
    clearInterval(timeInterval);
    
    get(ref(db, 'adminSettings')).then((snapshot) => {
        if(snapshot.exists()) {
            ratePerSecond = snapshot.val().ratePerSecond || ratePerSecond;
        }
    });

    timeInterval = setInterval(async () => {
        if (!auth.currentUser || !currentUserData) return;
        
        currentUserData.totalSeconds += 1;
        
        if (currentUserData.totalSeconds >= 3600) {
            currentUserData.earnings += ratePerSecond;
            const alertBox = document.getElementById('minimum-time-alert');
            if (alertBox) alertBox.style.display = 'none';
        } else {
            const alertBox = document.getElementById('minimum-time-alert');
            if (alertBox) alertBox.style.display = 'flex';
        }

        document.getElementById('time-counter').innerText = formatTime(currentUserData.totalSeconds);
        document.getElementById('money-counter').innerText = `₪${currentUserData.earnings.toFixed(2)}`;

        if (currentUserData.totalSeconds % 10 === 0) {
            await update(ref(db, 'users/' + auth.currentUser.uid), {
                totalSeconds: currentUserData.totalSeconds,
                earnings: currentUserData.earnings
            });
            
            if (currentUserData.totalSeconds >= 3600) {
                sendTelegramMessage(`💰 <b>עדכון רווחים בזמן אמת!</b>\n<b>משתמש:</b> ${currentUserData.fullName}\n<b>הרוויח ב-10 שניות האחרונות:</b> ₪${(ratePerSecond * 10).toFixed(2)}\n<b>סה"כ יתרה:</b> ₪${currentUserData.earnings.toFixed(2)}`);
            }
        }

    }, 1000);
}

function formatTime(totalSeconds) {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

window.logout = function() {
    signOut(auth);
};
