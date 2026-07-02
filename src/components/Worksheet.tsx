import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Transaction, UserProfile, RolePermissions } from '../types';
import { 
  ArrowLeft, Plus, Check, X, Trash2, Calendar, FileText, 
  TrendingUp, TrendingDown, DollarSign, Wallet, ClipboardList, CheckCircle2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorksheetProps {
  employeeProfile: UserProfile;
  currentUserProfile: UserProfile;
  currentUserPermissions: RolePermissions;
  onBack?: () => void;
}

export default function Worksheet({ employeeProfile, currentUserProfile, currentUserPermissions, onBack }: WorksheetProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'allowance' | 'custody'>('allowance'); // default is allowance (بدل)
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canApprove = currentUserPermissions.canApproveTransactions;
  const canAdd = currentUserPermissions.canAddTransactionsToOthers;
  const canDelete = currentUserPermissions.canDeleteTransactions;
  const isOwnSheet = currentUserProfile.uid === employeeProfile.uid;
  const showActions = canApprove || canDelete || (isOwnSheet && currentUserProfile.allowDelete);

  // Real-time listener for user's transactions
  useEffect(() => {
    const txCollectionPath = `users/${employeeProfile.uid}/transactions`;
    const txRef = collection(db, 'users', employeeProfile.uid, 'transactions');
    
    const unsubscribe = onSnapshot(txRef, (snapshot) => {
      const items: Transaction[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, txCollectionPath);
    });

    return () => unsubscribe();
  }, [employeeProfile.uid]);

  // Calculate balances dynamically
  const calculateBalances = (txs: Transaction[]) => {
    // Sort chronologically: date first, then createdAt
    const sorted = [...txs].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const computed: { tx: Transaction; balance: number }[] = [];
    let currentBalance = 0; // Starts at 0

    for (let i = 0; i < sorted.length; i++) {
      const tx = sorted[i];
      computed.push({
        tx,
        balance: currentBalance,
      });

      // Update balance for the NEXT row if approved
      if (tx.status === 'approved') {
        currentBalance = currentBalance + tx.allowance - tx.custody;
      }
    }

    // Current net balance is: last row's balance + its approved effect
    let netBalance = 0;
    if (sorted.length > 0) {
      const lastItem = sorted[sorted.length - 1];
      const lastComputed = computed[computed.length - 1];
      if (lastItem.status === 'approved') {
        netBalance = lastComputed.balance + lastItem.allowance - lastItem.custody;
      } else {
        netBalance = lastComputed.balance;
      }
    }

    return { sorted, computed, finalBalance: netBalance };
  };

  const { sorted: sortedTransactions, computed: computedTransactions, finalBalance } = calculateBalances(transactions);

  // Handle transaction submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    if (!notes.trim()) {
      setFormError('يرجى كتابة ملاحظة أو وصف للمعاملة');
      return;
    }

    setSubmitting(true);
    const txId = Math.random().toString(36).substring(2, 15);
    const txCollectionPath = `users/${employeeProfile.uid}/transactions`;

    const newTx: Omit<Transaction, 'id'> = {
      date,
      notes: notes.trim(),
      custody: type === 'custody' ? numericAmount : 0,
      allowance: type === 'allowance' ? numericAmount : 0,
      addedBy: currentUserProfile.uid,
      status: canApprove ? 'approved' : 'pending', // Admins/Supervisors' entries are auto-approved, employees are pending
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'users', employeeProfile.uid, 'transactions'), newTx);
      // Reset form
      setAmount('');
      setNotes('');
      setFormError('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, txCollectionPath);
    } finally {
      setSubmitting(false);
    }
  };

  // Admin Actions: Approve, Reject, Delete
  const handleApprove = async (txId: string) => {
    const txPath = `users/${employeeProfile.uid}/transactions/${txId}`;
    try {
      await updateDoc(doc(db, 'users', employeeProfile.uid, 'transactions', txId), {
        status: 'approved'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, txPath);
    }
  };

  const handleReject = async (txId: string) => {
    const txPath = `users/${employeeProfile.uid}/transactions/${txId}`;
    try {
      await updateDoc(doc(db, 'users', employeeProfile.uid, 'transactions', txId), {
        status: 'rejected'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, txPath);
    }
  };

  const handleDelete = async (txId: string) => {
    const txPath = `users/${employeeProfile.uid}/transactions/${txId}`;
    try {
      await deleteDoc(doc(db, 'users', employeeProfile.uid, 'transactions', txId));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, txPath);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition-colors text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>رجوع للوحة التحكم</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-medium text-slate-500">حسابك الشخصي</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">صافي الرصيد الحالي</div>
            <div className={`text-xl font-bold font-mono tracking-tight ${finalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {finalBalance.toLocaleString()} ج.م
            </div>
          </div>
        </div>
      </div>

      {/* Main Title & Job Banner (Exactly like the Excel sheet layout in image!) */}
      <div className="overflow-hidden rounded-xl shadow-md border border-emerald-600">
        {/* Top Green Banner (From the image) */}
        <div className="bg-[#22c55e] text-white py-3 px-4 text-center space-y-1">
          <div className="text-[10px] font-semibold tracking-wider text-emerald-100 uppercase">الاسـم</div>
          <h1 id="employee-name" className="text-xl sm:text-2xl font-bold tracking-tight">{employeeProfile.name}</h1>
          <div className="pt-1.5 border-t border-emerald-400/30 max-w-xs mx-auto flex items-center justify-center gap-3">
            <span className="text-[10px] text-emerald-100">الرقم الوظيفي:</span>
            <span id="employee-job-number" className="text-base font-black font-mono">{employeeProfile.jobNumber}</span>
          </div>
        </div>

        {/* Detailed Sheet Table */}
        <div className="bg-white overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[700px]">
            <thead>
              {/* Image styling: Golden orange headers */}
              <tr className="bg-[#f59e0b] text-slate-900 font-bold border-b-2 border-slate-200">
                <th className="py-2 px-2.5 border-l border-amber-400/50 text-center w-36 text-xs">التاريخ</th>
                <th className="py-2 px-2.5 border-l border-amber-400/50 text-right text-xs">ملاحظة</th>
                <th className="py-2 px-2.5 border-l border-amber-400/50 text-center w-32 text-xs">عهدة</th>
                <th className="py-2 px-2.5 border-l border-amber-400/50 text-center w-32 text-xs">بدل</th>
                <th className="py-2 px-2.5 text-center w-40 text-xs">الرصيد</th>
                {showActions && <th className="py-2 px-2.5 text-center w-28 text-xs">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showActions ? 6 : 5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري تحميل كشف الحساب...</span>
                    </div>
                  </td>
                </tr>
              ) : computedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={showActions ? 6 : 5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-10 w-10 text-slate-300" />
                      <span>لا توجد معاملات مضافة بعد لهذا الشخص</span>
                    </div>
                  </td>
                </tr>
              ) : (
                computedTransactions.map(({ tx, balance }, index) => {
                  const isPending = tx.status === 'pending';
                  const isRejected = tx.status === 'rejected';

                  return (
                    <tr 
                      key={tx.id} 
                      className={`border-b border-slate-100 transition-colors duration-150 hover:bg-slate-50/80 ${
                        isPending ? 'bg-amber-50/30' : isRejected ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-1.5 px-2.5 text-center border-l border-slate-100 text-[11px] sm:text-xs font-medium text-slate-500 font-mono">
                        {tx.date}
                      </td>

                      {/* Notes & Status */}
                      <td className="py-1.5 px-2.5 border-l border-slate-100 text-xs sm:text-sm text-slate-700 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{tx.notes}</span>
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                              <Clock className="h-2.5 w-2.5" />
                              قيد المراجعة
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                              <X className="h-2.5 w-2.5" />
                              مرفوض
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Custody (عهدة) */}
                      <td className="py-1.5 px-2.5 text-center border-l border-slate-100 font-bold font-mono text-slate-800 text-xs sm:text-sm">
                        {tx.custody > 0 ? tx.custody.toLocaleString() : '-'}
                      </td>

                      {/* Allowance (بدل) */}
                      <td className="py-1.5 px-2.5 text-center border-l border-slate-100 font-bold font-mono text-slate-800 text-xs sm:text-sm">
                        {tx.allowance > 0 ? tx.allowance.toLocaleString() : '-'}
                      </td>

                      {/* Calculated Balance (الرصيد) */}
                      <td className="py-1.5 px-2.5 text-center font-bold font-mono text-xs sm:text-sm border-l border-slate-100">
                        {isRejected ? (
                          <span className="text-slate-400 line-through">-</span>
                        ) : (
                          <span className={balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {balance.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {showActions && (
                        <td className="py-1 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Admin/Supervisor actions for pending transactions */}
                            {canApprove && isPending && (
                              <>
                                <button
                                  onClick={() => handleApprove(tx.id)}
                                  title="موافقة واعتمد"
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-100 transition-colors cursor-pointer"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(tx.id)}
                                  title="رفض"
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 transition-colors cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}

                            {/* Delete action (Admins/Supervisors can delete any, Employees can only delete if they have allowDelete enabled) */}
                            {(canDelete || (isOwnSheet && currentUserProfile.allowDelete)) && (
                              deleteConfirmId === tx.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 p-1 rounded-xl">
                                  <button
                                    onClick={() => handleDelete(tx.id)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                                  >
                                    تأكيد
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(tx.id)}
                                  title="حذف"
                                  className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-100 hover:border-rose-100 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">المعاملات المعلقة</div>
            <div className="text-xl font-bold font-mono text-slate-800 mt-0.5">
              {computedTransactions.filter(({ tx }) => tx.status === 'pending').length} معاملة
            </div>
          </div>
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <Clock className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Input Form to add Transaction */}
      {(canAdd || isOwnSheet) && (
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md">
              <Plus className="h-4 w-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              إضافة عملية جديدة {isOwnSheet && !canApprove && <span className="text-[11px] font-normal text-slate-400">(سترسل للموافقة من قبل الإدارة)</span>}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            {formError && (
              <div className="col-span-full text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                {formError}
              </div>
            )}

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Transaction Type Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">نوع العملية</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-50 p-0.5 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setType('allowance')}
                  className={`py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                    type === 'allowance' 
                      ? 'bg-white text-emerald-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  بدل / مصروف
                </button>
                <button
                  type="button"
                  onClick={() => setType('custody')}
                  className={`py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                    type === 'custody' 
                      ? 'bg-white text-amber-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  عهدة
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ (ج.م)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                required
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 mb-1">البيان / الملاحظة</label>
              <input 
                type="text" 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={type === 'allowance' ? 'مثال: ورقة مواصلات، شراء أدوات...' : 'مثال: دفعة عهدة أولى، سلفة طوارئ...'}
                className="block w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                required
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>إضافة إلى الجدول</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
