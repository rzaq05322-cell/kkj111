// استيراد الدوال اللازمة من Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// إعدادات Firebase 
const firebaseConfig = {
    apiKey: "AIzaSyA4dojPGcgoUcqCG4o27pWkIDFEsXyiOhA",
    authDomain: "jhgghfh-df773.firebaseapp.com",
    projectId: "jhgghfh-df773",
    storageBucket: "jhgghfh-df773.firebasestorage.app",
    messagingSenderId: "1059113573749",
    appId: "1:1059113573749:web:c24bcfe3b30c91cdc9473c"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// تفعيل العمل أوفلاين (بدون إنترنت)
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log("التبويبات المتعددة مفتوحة، لا يمكن تفعيل الأوفلاين");
        } else if (err.code == 'unimplemented') {
            console.log("المتصفح لا يدعم الميزة");
        }
    });

// تصدير المتغيرات لاستخدامها في script.js
window.db = db;
window.collection = collection;
window.addDoc = addDoc;
window.onSnapshot = onSnapshot;
window.updateDoc = updateDoc;
window.doc = doc;
window.deleteDoc = deleteDoc;

// إطلاق حدث يخبر الملف الرئيسي أن قاعدة البيانات جاهزة
const event = new Event('firebaseReady');
window.dispatchEvent(event);
