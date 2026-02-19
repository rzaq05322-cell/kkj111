// استيراد الدوال اللازمة من Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// إعدادات Firebase - قم بنسخها من Firebase Console
 const firebaseConfig = {
    apiKey: "AIzaSyBpD-dnLhMKjvSseMbVJqvXUCrYtU2t9Kg",
    authDomain: "dfvf22222222222.firebaseapp.com",
    projectId: "dfvf22222222222",
    storageBucket: "dfvf22222222222.firebasestorage.app",
    messagingSenderId: "472171312737",
    appId: "1:472171312737:web:9b087eaaff9d59ef831c20"
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
