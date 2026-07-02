import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, firebaseConfig, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Transaction, RolePermissions, PermissionsConfig } from '../types';
import { 
  Users, UserCheck, Search, ShieldAlert, Award, FileSpreadsheet, 
  Trash2, Mail, Hash, ChevronLeft, UserX, AlertCircle, Clock, UserPlus, Lock, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  currentUserProfile: UserProfile;
  currentUserPermissions: RolePermissions;
  permissionsConfig: PermissionsConfig;
  onSelectEmployee: (employee: UserProfile) => void;
}

export default function AdminPanel({ currentUserProfile, currentUserPermissions, permissionsConfig, onSelectEmployee }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'employee' | 'pending'>('all');

  // User Approval form state for currently selected pending user
  const [selectedPendingUser, setSelectedPendingUser] = useState<UserProfile | null>(null);
  const [approveName, setApproveName] = useState('');
  const [approveJobNumber, setApproveJobNumber] = useState('');
  const [approveRole, setApproveRole] = useState<'employee' | 'supervisor' | 'admin'>('employee');
  const [approveError, setApproveError] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  // New User Creation states
  const [newUserName, setNewUserName] = useState('');
  const [newUserJobNumber, setNewUserJobNumber] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'employee' | 'supervisor' | 'admin'>('employee');
  const [newUserAllowDelete, setNewUserAllowDelete] = useState(false);
  const [approveAllowDelete, setApproveAllowDelete] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Password Viewing & Editing states
  const [editingPasswordUid, setEditingPasswordUid] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [passwordSaveLoading, setPasswordSaveLoading] = useState(false);

  // Dynamic Permissions state
  const [savingPerms, setSavingPerms] = useState(false);
  const [permsConfigState, setPermsConfigState] = useState<PermissionsConfig>(permissionsConfig);

  useEffect(() => {
    setPermsConfigState(permissionsConfig);
  }, [permissionsConfig]);

  const handleTogglePermission = (role: 'admin' | 'supervisor' | 'employee', perm: keyof RolePermissions) => {
    if (role === 'admin' && perm === 'canManageUsers') {
      alert('لا يمكنك إلغاء صلاحية إدارة المستخدمين لمدير النظام لتجنب إغلاق الحساب.');
      return;
    }
    setPermsConfigState(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [perm]: !prev[role][perm]
      }
    }));
  };

  const handleSavePermissions = async () => {
    setSavingPerms(true);
    try {
      await setDoc(doc(db, 'settings', 'permissions'), permsConfigState);
      alert('تم حفظ وتحديث صلاحيات المجموعات بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الصلاحيات في قاعدة البيانات.');
    } finally {
      setSavingPerms(false);
    }
  };

  const handleSavePassword = async (uid: string) => {
    if (!newPasswordValue.trim()) return;
    setPasswordSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        password: newPasswordValue.trim()
      });
      setEditingPasswordUid(null);
      setNewPasswordValue('');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تعديل كلمة المرور');
    } finally {
      setPasswordSaveLoading(false);
    }
  };

  const normalizeInputToEmail = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes('@')) {
      return trimmed.toLowerCase();
    }
    const username = trimmed.replace(/\s+/g, '').toLowerCase();
    if (username === 'markosgad' || username === 'markosgad1' || username === 'markos') {
      return 'markosgad1@gmail.com';
    }
    return `${username}@app.local`;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (!newUserName.trim() || !newUserJobNumber.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setCreateError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (newUserPassword.length < 6) {
      setCreateError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setCreateLoading(true);

    try {
      // Direct username identifier
      const usernameId = newUserEmail.trim().replace(/\s+/g, '').toLowerCase();

      // Check if user already exists
      const docSnap = await getDocs(collection(db, 'users'));
      const exists = docSnap.docs.some(doc => doc.id === usernameId || (doc.data() as UserProfile).email?.toLowerCase() === newUserEmail.trim().toLowerCase());
      
      if (exists) {
        setCreateError('هذا الاسم أو اسم المستخدم مستخدم بالفعل لحساب آخر');
        setCreateLoading(false);
        return;
      }

      // Create the user profile doc directly in Firestore
      const userProfile = {
        uid: usernameId,
        name: newUserName.trim(),
        jobNumber: newUserJobNumber.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        password: newUserPassword,
        createdAt: new Date().toISOString(),
        allowDelete: newUserAllowDelete
      };

      await setDoc(doc(db, 'users', usernameId), userProfile);

      // Success feedback and reset fields
      setCreateSuccess(`تم إنشاء الحساب للفني ${newUserName} بنجاح! يمكنه الآن تسجيل الدخول باسم المستخدم أو البريد الإلكتروني.`);
      setNewUserName('');
      setNewUserJobNumber('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('employee');
      setNewUserAllowDelete(false);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setCreateLoading(false);
    }
  };

  // Live subscription to users collection
  useEffect(() => {
    const usersCollectionPath = 'users';
    const usersRef = collection(db, 'users');
    
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const items: UserProfile[] = [];
      snapshot.forEach((doc) => {
        items.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, usersCollectionPath);
    });

    return () => unsubscribe();
  }, []);

  // Monitor total pending transactions across ALL users
  useEffect(() => {
    if (users.length === 0) return;

    let totalPending = 0;
    const unsubscribes: (() => void)[] = [];

    // Subscribe to transactions of each non-pending user
    users.forEach((u) => {
      if (u.role === 'pending') return;

      const txRef = collection(db, 'users', u.uid, 'transactions');
      const unsub = onSnapshot(txRef, (snapshot) => {
        let count = 0;
        snapshot.forEach((doc) => {
          const tx = doc.data() as Transaction;
          if (tx.status === 'pending') {
            count++;
          }
        });
        // We'll calculate a unified state. For simplicity, let's keep it simple or query globally if possible,
        // or just aggregate locally.
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [users]);

  // Handle approving user account and setting profile details
  const handleApproveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApproveError('');

    if (!selectedPendingUser) return;
    if (!approveName.trim() || !approveJobNumber.trim()) {
      setApproveError('يرجى ملء كافة الحقول لإتمام عملية التفعيل');
      return;
    }

    setApproveLoading(true);
    const userDocPath = `users/${selectedPendingUser.uid}`;

    try {
      await updateDoc(doc(db, 'users', selectedPendingUser.uid), {
        name: approveName.trim(),
        jobNumber: approveJobNumber.trim(),
        role: approveRole,
        allowDelete: approveAllowDelete
      });
      setSelectedPendingUser(null);
      setApproveName('');
      setApproveJobNumber('');
      setApproveAllowDelete(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    } finally {
      setApproveLoading(false);
    }
  };

  // Open approval modal/form for a pending user
  const openApproval = (user: UserProfile) => {
    setSelectedPendingUser(user);
    setApproveName(user.name || '');
    setApproveJobNumber(user.jobNumber || '');
    setApproveRole('employee');
    setApproveAllowDelete(user.allowDelete || false);
  };

  // Handle deleting a user profile
  const handleDeleteUser = async (userUid: string) => {
    if (userUid === currentUserProfile.uid) {
      alert('لا يمكنك حذف حسابك الحالي');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟ ستفقد كل بياناته.')) return;

    const userDocPath = `users/${userUid}`;
    try {
      await deleteDoc(doc(db, 'users', userUid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, userDocPath);
    }
  };

  // Filter and search logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const pendingUsers = users.filter((u) => u.role === 'pending');
  const activeMembers = users.filter((u) => u.role !== 'pending');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* App Title Banner - placed at the very top of the page */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-slate-800">
        <div>
          <div className="text-xs text-slate-400 font-bold">مرحباً بك مجدداً يا مسؤول</div>
          <div className="text-lg sm:text-xl font-extrabold mt-1 text-emerald-400">{currentUserProfile.name}</div>
        </div>
        <div className="text-slate-400 text-xs sm:text-left font-medium">
          لوحة الإشراف المالي وإدارة العهد والبدلات
        </div>
      </div>

      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Users */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي الفريق النشط</div>
            <div id="active-members-count" className="text-2xl font-black font-mono mt-0.5 text-slate-800">
              {activeMembers.length}
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Pending Approval Requests */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">طلبات الحسابات المعلقة</div>
            <div id="pending-users-count" className="text-2xl font-black font-mono mt-0.5 text-slate-800">
              {pendingUsers.length}
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Manager/Admin count */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">المدراء والمشرفين</div>
            <div className="text-2xl font-black font-mono mt-0.5 text-slate-800">
              {users.filter((u) => u.role === 'admin' || u.role === 'supervisor').length}
            </div>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Panel Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left Column: Team Members list (Takes 2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-500" />
                <span>جدول كشوف الحسابات للفريق</span>
              </h2>

              {/* Roles Filter tabs */}
              <div className="inline-flex gap-1 bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs flex-wrap">
                {(['all', 'employee', 'supervisor', 'admin', 'pending'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                      roleFilter === r 
                        ? 'bg-white text-emerald-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {r === 'all' && 'الكل'}
                    {r === 'employee' && 'مستخدم عادي'}
                    {r === 'supervisor' && 'مشرف مالي'}
                    {r === 'admin' && 'مدير نظام'}
                    {r === 'pending' && 'معلق'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
                <Search className="h-5 w-5" />
              </span>
              <input
                type="text"
                placeholder="ابحث بالاسم، الرقم الوظيفي، أو البريد الإلكتروني..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pr-11 pl-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-xs transition-all"
              />
            </div>

            {/* Users List Grid */}
            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <span>جاري تحميل بيانات الفريق...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <UserX className="h-8 w-8 text-slate-300 mx-auto mb-1" />
                  <span className="text-xs">لا يوجد مستخدمون يطابقون خيارات البحث الحالية</span>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div 
                    key={u.uid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/75 rounded-xl border border-slate-100 transition-all group gap-2"
                  >
                    <div 
                      onClick={() => u.role !== 'pending' && onSelectEmployee(u)}
                      className={`flex items-center gap-3 flex-1 ${u.role !== 'pending' ? 'cursor-pointer' : ''}`}
                    >
                      {/* Job Number Badge or Circle */}
                      <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex flex-col items-center justify-center text-slate-600 shadow-sm group-hover:border-emerald-300 transition-colors shrink-0">
                        <span className="text-[9px] text-slate-400 font-bold leading-none">ID</span>
                        <span className="text-xs font-black font-mono text-slate-700 mt-0.5">{u.jobNumber || '-'}</span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors flex items-center gap-2">
                          <span>{u.name}</span>
                          {u.role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-extrabold border border-indigo-100">
                              مدير النظام
                            </span>
                          )}
                          {u.role === 'supervisor' && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-extrabold border border-purple-100">
                              مشرف مالي
                            </span>
                          )}
                          {u.role === 'employee' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-100">
                              مستخدم عادي
                            </span>
                          )}
                          {u.role === 'pending' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-extrabold border border-amber-100 animate-pulse">
                              طلب معلق
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</span>
                          {u.role !== 'pending' && (
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-slate-500">كلمة المرور:</span>
                              {editingPasswordUid === u.uid ? (
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                  <input 
                                    type="text"
                                    value={newPasswordValue}
                                    onChange={(e) => setNewPasswordValue(e.target.value)}
                                    placeholder="جديدة"
                                    className="px-1.5 py-0.5 font-mono text-xs w-24 border-0 focus:outline-none focus:ring-0 bg-transparent text-slate-800"
                                    autoFocus
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSavePassword(u.uid);
                                    }}
                                    disabled={passwordSaveLoading}
                                    className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
                                  >
                                    حفظ
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPasswordUid(null);
                                      setNewPasswordValue('');
                                    }}
                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                                    {u.password || 'Mero@2211'}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingPasswordUid(u.uid);
                                      setNewPasswordValue(u.password || 'Mero@2211');
                                    }}
                                    className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline font-bold cursor-pointer"
                                  >
                                    تعديل
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons on the left */}
                    <div className="flex items-center gap-2 mt-3 sm:mt-0 justify-end">
                      {u.role === 'pending' ? (
                        <button
                          onClick={() => openApproval(u)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>تفعيل وتعيين</span>
                        </button>
                      ) : (
                        <>
                          {/* Quick delete privilege toggle switch for Admin */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-xs transition-all">
                            <input 
                              type="checkbox"
                              id={`toggle-del-${u.uid}`}
                              checked={u.allowDelete || false}
                              onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                  await updateDoc(doc(db, 'users', u.uid), {
                                    allowDelete: checked
                                  });
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            />
                            <label htmlFor={`toggle-del-${u.uid}`} className="text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                              صلاحية الحذف
                            </label>
                          </div>

                          <button
                            onClick={() => onSelectEmployee(u)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            <span>عرض كشف الحساب</span>
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteUser(u.uid)}
                        disabled={u.uid === currentUserProfile.uid}
                        className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-100 transition-all cursor-pointer disabled:opacity-30 disabled:hover:bg-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Form / Alert section */}
        <div className="space-y-4">
          {/* Quick instructions or Approval Form */}
          <AnimatePresence mode="wait">
            {selectedPendingUser ? (
              <motion.div 
                key="approval-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-2xl border-2 border-amber-500 shadow-lg space-y-4"
              >
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">تفعيل حساب العضو</h3>
                    <p className="text-xs text-slate-400">تأكيد البيانات وضم العضو للفريق</p>
                  </div>
                </div>

                <form onSubmit={handleApproveUserSubmit} className="space-y-4">
                  {approveError && (
                    <div className="flex items-center gap-1.5 p-3 text-xs text-rose-800 bg-rose-50 rounded-xl border border-rose-100">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{approveError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم ثلاثي أو ثنائي</label>
                    <input 
                      type="text" 
                      value={approveName}
                      onChange={(e) => setApproveName(e.target.value)}
                      placeholder="بيتر عادل نسيم"
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الرقم الوظيفي</label>
                    <input 
                      type="text" 
                      value={approveJobNumber}
                      onChange={(e) => setApproveJobNumber(e.target.value)}
                      placeholder="822"
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الصلاحية / الدور</label>
                    <select
                      value={approveRole}
                      onChange={(e) => setApproveRole(e.target.value as any)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-semibold"
                    >
                      <option value="employee">مستخدم عادي / فني (رؤية حسابه الشخصي فقط)</option>
                      <option value="supervisor">مشرف مالي (إدارة الحسابات والاعتماد)</option>
                      <option value="admin">مدير نظام (صلاحية كاملة وتحكم بالصلاحيات)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input 
                      type="checkbox"
                      id="approveAllowDelete"
                      checked={approveAllowDelete}
                      onChange={(e) => setApproveAllowDelete(e.target.checked)}
                      className="h-4.5 w-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="approveAllowDelete" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      السماح لهذا المستخدم بحذف معاملاته الخاصة
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={approveLoading}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center"
                    >
                      {approveLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : 'تفعيل العضو'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPendingUser(null)}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {/* Create New User Account Form */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">إضافة فني / مهندس جديد</h3>
                      <p className="text-xs text-slate-400">إنشاء حساب جديد وتعيين كلمة المرور فوراً</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    {createError && (
                      <div className="flex items-center gap-1.5 p-3 text-xs text-rose-800 bg-rose-50 rounded-xl border border-rose-100">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{createError}</span>
                      </div>
                    )}

                    {createSuccess && (
                      <div className="flex items-center gap-1.5 p-3 text-xs text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-100">
                        <UserCheck className="h-4 w-4 shrink-0" />
                        <span>{createSuccess}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم ثلاثي أو ثنائي</label>
                      <input 
                        type="text" 
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="بيتر عادل نسيم"
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">الرقم الوظيفي</label>
                      <input 
                        type="text" 
                        value={newUserJobNumber}
                        onChange={(e) => setNewUserJobNumber(e.target.value)}
                        placeholder="822"
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المستخدم (أو البريد الإلكتروني)</label>
                      <input 
                        type="text" 
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="مثال: peter أو peter@company.com"
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-left"
                        dir="ltr"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">كلمة المرور (6 أحرف كحد أدنى)</label>
                      <input 
                        type="password" 
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-left"
                        dir="ltr"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">الصلاحية / الدور</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as any)}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-semibold"
                      >
                        <option value="employee">مستخدم عادي / فني (رؤية حسابه الشخصي فقط)</option>
                        <option value="supervisor">مشرف مالي (إدارة الحسابات والاعتماد)</option>
                        <option value="admin">مدير نظام (صلاحية كاملة وتحكم بالصلاحيات)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-200">
                      <input 
                        type="checkbox"
                        id="newUserAllowDelete"
                        checked={newUserAllowDelete}
                        onChange={(e) => setNewUserAllowDelete(e.target.checked)}
                        className="h-4.5 w-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="newUserAllowDelete" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        السماح لهذا المستخدم بحذف معاملاته الخاصة
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {createLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          <span>إنشاء الحساب فوراً</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>


              </div>
            )}
          </AnimatePresence>

          {/* Quick Alert list for pending user account additions */}
          {pendingUsers.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                <span>طلبات تسجيل قيد الانتظار ({pendingUsers.length})</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pendingUsers.map((u) => (
                  <div key={u.uid} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <div className="font-bold text-slate-700">{u.name}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">{u.email}</div>
                    </div>
                    <button
                      onClick={() => openApproval(u)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-[11px]"
                    >
                      تفعيل
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Group Permissions Panel (Only visible if allowed canManageUsers) */}
        {currentUserPermissions.canManageUsers && permsConfigState && (
          <div className="col-span-full bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">إعدادات وصلاحيات المجموعات والوظائف</h3>
                  <p className="text-xs text-slate-400">التحكم في صلاحيات الوصول والاعتماد لكل دور وظيفي في النظام بشكل ديناميكي</p>
                </div>
              </div>
              <button
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
              >
                {savingPerms ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : 'حفظ الصلاحيات الآن'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card for each role */}
              {([
                { key: 'admin', label: 'مدير نظام', desc: 'يمتلك كامل الصلاحيات الإدارية والمالية', color: 'indigo' },
                { key: 'supervisor', label: 'مشرف مالي', desc: 'مسؤول عن مراجعة المعاملات واعتمادها المباشر', color: 'purple' },
                { key: 'employee', label: 'مستخدم عادي / فني', desc: 'يسجل طلبات البدلات والعهدة الخاصة به فقط للتفعيل', color: 'emerald' }
              ] as const).map(({ key, label, desc, color }) => (
                <div key={key} className="bg-slate-50/75 p-4 rounded-xl border border-slate-100/80 space-y-3">
                  <div className="space-y-0.5">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 border border-slate-300`}>
                      {label}
                    </span>
                    <p className="text-[11px] text-slate-400 font-medium leading-tight mt-1">{desc}</p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-200/50">
                    {([
                      { perm: 'canViewAllSheets', label: 'رؤية كشوفات الجميع' },
                      { perm: 'canApproveTransactions', label: 'اعتماد ومراجعة المعاملات' },
                      { perm: 'canAddTransactionsToOthers', label: 'إضافة معاملات مباشرة للغير' },
                      { perm: 'canDeleteTransactions', label: 'صلاحية حذف المعاملات' },
                      { perm: 'canManageUsers', label: 'إدارة وتفعيل حسابات الموظفين' }
                    ] as const).map(({ perm, label: permLabel }) => (
                      <div key={perm} className="flex items-center justify-between text-xs bg-white py-1.5 px-2.5 rounded-lg border border-slate-100">
                        <span className="font-medium text-slate-700">{permLabel}</span>
                        <input
                          type="checkbox"
                          checked={permsConfigState[key]?.[perm] ?? false}
                          onChange={() => handleTogglePermission(key, perm)}
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
