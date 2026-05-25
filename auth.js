// ============================================
// auth.js - نظام المصادقة المشترك
// ============================================

const AUTH_CONFIG = {
    SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 ساعات
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000 // 15 دقيقة
};

// ============================================
// التحقق من المصادقة
// ============================================
function checkAuth(requiredRole = null) {
    const session = getSession();
    
    if (!session) {
        redirectToLogin();
        return false;
    }
    
    // التحقق من انتهاء الجلسة
    if (session.expiresAt < Date.now()) {
        clearSession();
        redirectToLogin();
        return false;
    }
    
    // التحقق من الدور
    if (requiredRole && session.role !== requiredRole && session.role !== 'manager') {
        showToast('⛔ ليس لديك صلاحية الوصول', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }
    
    // تحديث وقت الانتهاء (تمديد الجلسة)
    session.expiresAt = Date.now() + AUTH_CONFIG.SESSION_TIMEOUT;
    saveSession(session);
    
    return true;
}

// ============================================
// الحصول على الجلسة
// ============================================
function getSession() {
    try {
        const encrypted = localStorage.getItem('padel_auth_session');
        if (!encrypted) return null;
        return JSON.parse(atob(encrypted));
    } catch {
        return null;
    }
}

// ============================================
// حفظ الجلسة
// ============================================
function saveSession(session) {
    localStorage.setItem('padel_auth_session', btoa(JSON.stringify(session)));
}

// ============================================
// مسح الجلسة (تسجيل خروج)
// ============================================
function clearSession() {
    localStorage.removeItem('padel_auth_session');
    sessionStorage.removeItem('login_attempts');
    sessionStorage.removeItem('login_locked');
}

// ============================================
// إعادة التوجيه لتسجيل الدخول
// ============================================
function redirectToLogin() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage !== 'login.html') {
        window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
    }
}

// ============================================
// تسجيل الخروج
// ============================================
function logout() {
    clearSession();
    window.location.href = 'index.html';
}

// ============================================
// التحقق من عدد المحاولات
// ============================================
function checkLoginAttempts() {
    const attempts = parseInt(sessionStorage.getItem('login_attempts') || '0');
    const lockedUntil = parseInt(sessionStorage.getItem('login_locked') || '0');
    
    if (Date.now() < lockedUntil) {
        const remaining = Math.ceil((lockedUntil - Date.now()) / 60000);
        return { allowed: false, message: `الحساب مقفل. حاول بعد ${remaining} دقيقة` };
    }
    
    if (attempts >= AUTH_CONFIG.MAX_ATTEMPTS) {
        sessionStorage.setItem('login_locked', Date.now() + AUTH_CONFIG.LOCKOUT_DURATION);
        sessionStorage.removeItem('login_attempts');
        return { allowed: false, message: `تم قفل الحساب لـ 15 دقيقة` };
    }
    
    return { allowed: true };
}

// ============================================
// تسجيل محاولة فاشلة
// ============================================
function recordFailedAttempt() {
    const attempts = parseInt(sessionStorage.getItem('login_attempts') || '0') + 1;
    sessionStorage.setItem('login_attempts', attempts.toString());
}

// ============================================
// التحقق من الصلاحيات
// ============================================
function isManager() {
    const session = getSession();
    return session && session.role === 'manager';
}

function isWorker() {
    const session = getSession();
    return session && (session.role === 'worker' || session.role === 'manager');
}

function getCurrentUser() {
    const session = getSession();
    return session ? session.username : null;
}

function getCurrentRole() {
    const session = getSession();
    return session ? session.role : null;
}

// ============================================
// إرسال اسم المستخدم لـ Supabase (للـ RLS)
// ============================================
function setSupabaseUser(supabaseClient) {
    const session = getSession();
    if (session) {
        // تعيين متغير الجلسة للـ RLS
        supabaseClient.rpc('set_config', { 
            key: 'app.current_user', 
            value: session.username 
        });
    }
}

// ============================================
// حماية إضافية: منع العودة للصفحات المحمية بعد الخروج
// ============================================
function preventBackAfterLogout() {
    if (performance.navigation.type === 2) { // نوع 2 = back button
        const session = getSession();
        if (!session) {
            window.location.href = 'login.html';
        }
    }
}

// ============================================
// تهيئة الحماية عند تحميل الصفحة
// ============================================
function initAuthProtection(requiredRole = null) {
    // منع الـ back button
    if (window.history && window.history.pushState) {
        window.history.pushState(null, null, window.location.href);
        window.onpopstate = function() {
            window.history.pushState(null, null, window.location.href);
        };
    }
    
    // التحقق من المصادقة
    return checkAuth(requiredRole);
}

// ============================================
// إشعار Toast (للصفحات التي لا تحتوي على دالة showToast)
// ============================================
function showToast(message, type = 'success') {
    // إذا كانت الدالة موجودة في الصفحة، استخدمها
    if (typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }
    
    // إنشاء toast مؤقت
    let toast = document.getElementById('auth-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'auth-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            padding: 1rem 2rem;
            border-radius: 12px;
            font-weight: 700;
            z-index: 9999;
            opacity: 0;
            transition: all 0.4s;
            font-family: 'Tajawal', sans-serif;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.background = type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
    toast.style.border = `1px solid ${type === 'error' ? '#EF4444' : '#10B981'}`;
    toast.style.color = type === 'error' ? '#EF4444' : '#10B981';
    
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    });
    
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-100px)';
        toast.style.opacity = '0';
    }, 4000);
}

// ============================================
// تصدير للاستخدام في الموديولات (إذا احتجت)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkAuth,
        getSession,
        saveSession,
        clearSession,
        logout,
        isManager,
        isWorker,
        getCurrentUser,
        getCurrentRole,
        initAuthProtection
    };
}
