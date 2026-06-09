importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyDEYg0b9wR_6gAOpF5YnZ_3m2fOPhYpS7s",
  authDomain: "kablu-ksaf-bechinam.firebaseapp.com",
  databaseURL: "https://kablu-ksaf-bechinam-default-rtdb.firebaseio.com",
  projectId: "kablu-ksaf-bechinam",
  storageBucket: "kablu-ksaf-bechinam.appspot.com",
  messagingSenderId: "1098471629482",
  appId: "1:1098471629482:web:cbd836bfa9d023fbc0183e"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// האזנה ודחיפת הודעות כשהאתר סגור לחלוטין במכשיר
messaging.onBackgroundMessage((payload) => {
  console.log('התראה התקבלה ברקע: ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png', 
    badge: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
