import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCucfPLcVdnPj-E6fX7KHN-NZ2yGWnCxbI",
  authDomain: "lost-d7bf2.firebaseapp.com",
  projectId: "lost-d7bf2",
  storageBucket: "lost-d7bf2.firebasestorage.app",
  messagingSenderId: "537048307990",
  appId: "1:537048307990:web:02e099f75173134f259837"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);