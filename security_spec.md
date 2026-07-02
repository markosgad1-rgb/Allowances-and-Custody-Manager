# Security Specification for Allowances and Custody Manager

## 1. Data Invariants
- **User Account Integrity**: A User document can only be created/updated if authenticated, and can only be read or modified by the user themselves or an admin.
- **Transaction Ownership**: A Transaction can only be created within a user's `/users/{userId}/transactions/{transactionId}` subcollection.
- **Role-Based Access Control**: Admins can read and write all transactions. Employees can only read and write their own transactions, and cannot modify other employees' data.
- **Transaction Status Invariant**: Only Admins can change a transaction's status to `approved` or `rejected`. Employees can only create transactions with the `pending` status.
- **Type Safety and Bounds**: Numeric fields (`custody`, `allowance`) must be non-negative and validated as numbers.

## 2. The "Dirty Dozen" Malicious Payloads
Here are 12 specific payloads attempting to bypass security constraints:

1. **User Profile Hijacking**: Attempting to create or edit another user's profile.
2. **Self-Admin Escalation**: An employee attempting to change their own role to "admin".
3. **Impersonated Transaction Creation**: An employee attempting to create a transaction in another employee's subcollection.
4. **Direct Status Overriding**: An employee attempting to submit a transaction pre-marked as `approved`.
5. **Admin Status Bypassing**: An employee attempting to transition a transaction status from `pending` to `approved` themselves.
6. **Poisoned Transaction ID**: Injecting an extremely long string (1MB) as a transaction ID to cause wallet denial of service.
7. **Negative Custody Value**: Submitting a negative custody amount (e.g., `-1000`) to artificially inflate the balance.
8. **Negative Allowance Value**: Submitting a negative allowance amount to manipulate the balance calculations.
9. **String for Numeric Fields**: Submitting a string `"1000"` for the `custody` or `allowance` field.
10. **Shadow Field Injection**: Injecting a custom ghost field `isSuperuser: true` into a transaction document.
11. **Blanket Query Reading**: A non-admin user attempting to query or list the global `/users` collection.
12. **Tampering with Timestamps**: Forcing a future date or backdated `createdAt` timestamp rather than using the server timestamp.

## 3. Security Rules Draft (firestore.rules)
Below we define the secure firestore rules that prevent all of the above payloads.
