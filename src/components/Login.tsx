import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LogIn, AlertCircle, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginProps {
  onAuthSuccess: () => void;
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Normalize username/email into a clean ID
    const trimmedInput = emailOrUser.trim().toLowerCase();
    let usernameId = trimmedInput.replace(/\s+/g, '');

    if (usernameId === 'markosgad' || usernameId === 'markosgad1' || usernameId === 'markos' || trimmedInput === 'markosgad1@gmail.com') {
      usernameId = 'markosgad';
    }

    try {
      const isSystemAdminAttempt = usernameId === 'markosgad' && password === 'Mero@2211';

      // Fetch the user profile directly from Firestore users collection
      const docRef = doc(db, 'users', usernameId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        
        // Verify password
        if (profile.password === password || (isSystemAdminAttempt && !profile.password)) {
          // Update password in db if it was missing
          if (isSystemAdminAttempt && !profile.password) {
            await setDoc(docRef, { ...profile, password: 'Mero@2211' }, { merge: true });
            profile.password = 'Mero@2211';
          }
          
          localStorage.setItem('allowances_session', JSON.stringify(profile));
          onAuthSuccess();
        } else {
          setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
      } else {
        // If the user doesn't exist but it's the admin credentials, bootstrap the admin!
        if (isSystemAdminAttempt) {
          const adminProfile: UserProfile = {
            uid: 'markosgad',
            name: 'markos gad',
            jobNumber: 'Admin',
            email: 'markosgad1@gmail.com',
            role: 'admin',
            password: 'Mero@2211',
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, adminProfile);
          localStorage.setItem('allowances_session', JSON.stringify(adminProfile));
          onAuthSuccess();
        } else {
          setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء محاولة تسجيل الدخول: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-50 rounded-2xl text-emerald-600 mb-4 shadow-sm">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 id="login-title" className="text-3xl font-extrabold text-slate-900 tracking-tight">
            نظام إدارة البدلات والعهدة
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            للفنيين والمهندسين والمديرين الماليين
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-2 p-4 text-sm text-rose-800 bg-rose-50 rounded-xl border border-rose-100 animate-pulse">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-md space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني أو اسم المستخدم</label>
              <input
                type="text"
                required
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all text-left"
                placeholder="markos gad أو example@company.com"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all text-left"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  تسجيل الدخول
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
