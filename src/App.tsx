import React, { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, RolePermissions, PermissionsConfig, UserRole } from './types';
import Login from './components/Login';
import Worksheet from './components/Worksheet';
import AdminPanel from './components/AdminPanel';
import { LogOut, User, Sparkles, Clock } from 'lucide-react';

export const DEFAULT_PERMISSIONS: PermissionsConfig = {
  admin: {
    canViewAllSheets: true,
    canApproveTransactions: true,
    canAddTransactionsToOthers: true,
    canDeleteTransactions: true,
    canManageUsers: true,
  },
  supervisor: {
    canViewAllSheets: true,
    canApproveTransactions: true,
    canAddTransactionsToOthers: true,
    canDeleteTransactions: false,
    canManageUsers: false,
  },
  employee: {
    canViewAllSheets: false,
    canApproveTransactions: false,
    canAddTransactionsToOthers: false,
    canDeleteTransactions: false,
    canManageUsers: false,
  },
};

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('allowances_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [permissionsConfig, setPermissionsConfig] = useState<PermissionsConfig>(DEFAULT_PERMISSIONS);
  const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync / Verify profile status on load in real-time
  useEffect(() => {
    if (!userProfile?.uid) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', userProfile.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const freshData = docSnap.data() as UserProfile;
        setUserProfile(freshData);
        localStorage.setItem('allowances_session', JSON.stringify(freshData));
      } else {
        // Document doesn't exist anymore, log out
        setUserProfile(null);
        localStorage.removeItem('allowances_session');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to user session:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.uid]);

  // Fetch / Subscribe to the dynamic role permissions from Firestore
  useEffect(() => {
    const permRef = doc(db, 'settings', 'permissions');
    const unsubscribe = onSnapshot(permRef, (docSnap) => {
      if (docSnap.exists()) {
        setPermissionsConfig(docSnap.data() as PermissionsConfig);
      } else {
        // Bootstrap if it doesn't exist
        setDoc(permRef, DEFAULT_PERMISSIONS).catch((err) => {
          console.error("Error bootstrapping permissions:", err);
        });
      }
    }, (error) => {
      console.error("Error reading permissions from Firestore:", error);
    });
    return () => unsubscribe();
  }, []);

  // Handle manual logout
  const handleLogout = async () => {
    setUserProfile(null);
    setSelectedEmployee(null);
    localStorage.removeItem('allowances_session');
  };

  // Re-fetch profile on login success
  const handleAuthSuccess = () => {
    const saved = localStorage.getItem('allowances_session');
    if (saved) {
      setUserProfile(JSON.parse(saved));
    }
  };

  const getUserPermissions = (): RolePermissions => {
    if (!userProfile || userProfile.role === 'pending') {
      return {
        canViewAllSheets: false,
        canApproveTransactions: false,
        canAddTransactionsToOthers: false,
        canDeleteTransactions: false,
        canManageUsers: false,
      };
    }
    const role = userProfile.role;
    return permissionsConfig[role] || DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.employee;
  };

  const permissions = getUserPermissions();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-slate-600 font-bold">جاري تحميل النظام والتحقق من الصلاحيات...</div>
      </div>
    );
  }

  // If not logged in, show Login
  if (!userProfile) {
    return <Login onAuthSuccess={handleAuthSuccess} />;
  }

  // If logged in, but role is pending approval
  if (userProfile.role === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-4 bg-amber-50 text-amber-600 rounded-full animate-pulse">
            <Clock className="h-10 w-10" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">حسابك قيد الانتظار</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              مرحباً بك يا <span className="font-bold text-slate-800">{userProfile.name}</span>. تم تسجيل حسابك بنجاح في النظام ولكنه معلق حالياً بانتظار تفعيل المسؤول المالي.
            </p>
            <p className="text-xs text-amber-600 font-medium">
              يرجى إبلاغ المشرف المالي أو المسؤول ليقوم بتنشيط حسابك وتعيين رقمك الوظيفي.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getRoleBadgeLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'مدير النظام';
      case 'supervisor': return 'مشرف مالي';
      case 'employee': return `فني / مهندس (رقم: ${userProfile.jobNumber})`;
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Universal Sticky Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-sm backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          {/* Logo Title */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <span id="app-header-title" className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
              البدلات والعهدة الماليّة
            </span>
          </div>

          {/* User Profile Badge & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{userProfile.name}</span>
              <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                {getRoleBadgeLabel(userProfile.role)}
              </span>
            </div>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <User className="h-4 w-4" />
            </div>
            
            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer border border-rose-100/50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 py-4 sm:py-8">
        {permissions.canViewAllSheets ? (
          selectedEmployee ? (
            <Worksheet 
              employeeProfile={selectedEmployee} 
              currentUserProfile={userProfile}
              currentUserPermissions={permissions}
              onBack={() => setSelectedEmployee(null)}
            />
          ) : (
            <div className="max-w-5xl mx-auto px-4">
              <AdminPanel 
                currentUserProfile={userProfile} 
                currentUserPermissions={permissions}
                permissionsConfig={permissionsConfig}
                onSelectEmployee={(emp) => setSelectedEmployee(emp)}
              />
            </div>
          )
        ) : (
          <Worksheet 
            employeeProfile={userProfile} 
            currentUserProfile={userProfile}
            currentUserPermissions={permissions}
          />
        )}
      </main>

      {/* Soft footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-200/50 mt-12 bg-white">
        <div>نظام إدارة العهد والبدلات الماليّة للمهندسين والفنيين © {new Date().getFullYear()}</div>
      </footer>
    </div>
  );
}
