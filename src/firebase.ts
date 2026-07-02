import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBjlcjFCRF1-X-zFg5z3IfolfUDk0Bg95g",
  authDomain: "allowances-and-custody-manager.firebaseapp.com",
  projectId: "allowances-and-custody-manager",
  storageBucket: "allowances-and-custody-manager.firebasestorage.app",
  messagingSenderId: "828784394536",
  appId: "1:828784394536:web:daae1416ae3b4fc14d501d",
  measurementId: "G-H5JPHD6K91"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
