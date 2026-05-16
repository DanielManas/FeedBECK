import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "ai-studio-applet-webapp-dbd9d",
  appId: "1:1040580306915:web:c2c6d1f2014c85845062d6",
  apiKey: "AIzaSyAGonfbFMgOS5brdUbqi_flVFWafbPdVM4",
  authDomain: "ai-studio-applet-webapp-dbd9d.firebaseapp.com",
  storageBucket: "ai-studio-applet-webapp-dbd9d.firebasestorage.app",
  messagingSenderId: "1040580306915",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-ebaaa682-72fa-431c-8629-b4fb1b3bcbcc");
