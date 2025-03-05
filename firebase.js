import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Import Firebase Storage

const firebaseConfig = {
    apiKey: "AIzaSyCfjj6Yz4b6an95iSws3AaHsi5JUST-v7E",
    authDomain: "workflow-management-c84d9.firebaseapp.com",
    projectId: "workflow-management-c84d9",
    storageBucket: "workflow-management-c84d9.firebasestorage.app", // Corrected storageBucket
    messagingSenderId: "520933173908",
    appId: "1:520933173908:web:6a5806a475417fdc582281",
    measurementId: "G-RS7LXBF1TY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Add this export
