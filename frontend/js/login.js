'use strict';
const API = 'http://localhost:3000/api/auth';

// ─── SEGURIDAD ───────────────
if (localStorage.getItem('amToken') || localStorage.getItem('amGuest') === 'true') {
    window.location.replace('index.html');
}

// ─── INICIALIZACIÓN ───────────
window.onload = function() {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        document.getElementById('lg-correo').value = savedEmail;
        document.getElementById('remember-me').checked = true;
    }
    if (window.lucide) lucide.createIcons();
    setupRealtimeValidation();

    // Cerrar modal de recuperación al hacer clic en el overlay
    const overlay = document.querySelector('.recovery-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeRecoveryModal);
    }
};

// ─── VALIDACIONES EN TIEMPO REAL ──
function setupRealtimeValidation() {
    const nombre = document.getElementById('rg-nombre');
    const correo = document.getElementById('rg-correo');
    const password = document.getElementById('rg-password');

    if (nombre) {
        nombre.addEventListener('input', function() {
            const val = this.value.trim();
            const fg = document.getElementById('rg-fg-nombre');
            const err = document.getElementById('rg-err-nombre');
            if (!val) {
                fg.classList.add('has-error');
                fg.classList.remove('has-success');
                err.textContent = 'Campo obligatorio';
            } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(val)) {
                fg.classList.add('has-error');
                fg.classList.remove('has-success');
                err.textContent = 'Solo letras y espacios';
            } else if (val.length < 2) {
                fg.classList.add('has-error');
                fg.classList.remove('has-success');
                err.textContent = 'Mínimo 2 caracteres';
            } else {
                fg.classList.remove('has-error');
                fg.classList.add('has-success');
                err.textContent = '';
            }
        });
    }

    if (correo) {
        correo.addEventListener('input', function() {
            const val = this.value.trim();
            const fg = document.getElementById('rg-fg-correo');
            const err = document.getElementById('rg-err-correo');
            if (!val) {
                fg.classList.add('has-error');
                fg.classList.remove('has-success');
                err.textContent = 'Campo obligatorio';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                fg.classList.add('has-error');
                fg.classList.remove('has-success');
                err.textContent = 'Correo inválido';
            } else {
                fg.classList.remove('has-error');
                fg.classList.add('has-success');
                err.textContent = '';
            }
        });
    }

    if (password) {
        password.addEventListener('input', function() {
            const val = this.value;
            const fg = document.getElementById('rg-fg-password');
            const err = document.getElementById('rg-err-password');
            const strengthBar = document.getElementById('password-strength');
            const reqList = document.getElementById('password-requirements');

            const hasMinLength = val.length >= 6;
            const hasUpperCase = /[A-Z]/.test(val);
            const hasNumber = /[0-9]/.test(val);
            const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(val);
            const allValid = hasMinLength && hasUpperCase && hasNumber && hasSpecial;

            if (reqList) {
                const items = reqList.querySelectorAll('li');
                const conditions = [hasMinLength, hasUpperCase, hasNumber, hasSpecial];
                items.forEach((li, idx) => {
                    li.className = conditions[idx] ? 'met' : 'unmet';
                    const icon = li.querySelector('.req-icon');
                    if (icon) {
                        if (conditions[idx]) {
                            icon.setAttribute('data-lucide', 'check-circle');
                            icon.style.color = '#4CAF50';
                        } else {
                            icon.setAttribute('data-lucide', 'x-circle');
                            icon.style.color = '';
                        }
                    }
                });
                if (window.lucide) lucide.createIcons();
            }

            let score = 0;
            if (hasMinLength) score++;
            if (hasUpperCase) score++;
            if (hasNumber) score++;
            if (hasSpecial) score++;
            if (val.length > 8) score++;
            const percent = Math.min(100, (score / 5) * 100);
            if (strengthBar) {
                strengthBar.style.width = percent + '%';
                strengthBar.className = percent < 30 ? 'strength-weak' : percent < 60 ? 'strength-medium' : 'strength-strong';
            }

            if (val && !allValid) {
                fg.classList.add('has-error');
                fg.classList.remove('has-success');
                err.textContent = 'No cumple todos los requisitos';
            } else if (val && allValid) {
                fg.classList.remove('has-error');
                fg.classList.add('has-success');
                err.textContent = '';
            } else {
                fg.classList.remove('has-error');
                fg.classList.remove('has-success');
                err.textContent = '';
            }
        });
    }
}

// ─── TOAST SYSTEM ──────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Contenedor de toasts no encontrado.');
        return;
    }
    const toast = document.createElement('div');
    const icons = { success: '✓', error: '✕', warning: '⚠️', delete: '◆' };
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || '●'}</span><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ─── LOGIN ────────────────────────────
async function handleLogin() {
    clearErrors('lg');

    const correo = document.getElementById('lg-correo').value.trim();
    const password = document.getElementById('lg-password').value;
    const remember = document.getElementById('remember-me').checked;

    let valid = true;
    if (!correo) { setError('lg', 'correo', 'Campo obligatorio'); valid = false; }
    if (!password) { setError('lg', 'password', 'Campo obligatorio'); valid = false; }
    if (!valid) return;

    if (remember) {
        localStorage.setItem('rememberedEmail', correo);
    } else {
        localStorage.removeItem('rememberedEmail');
    }

    const btn = document.getElementById('lg-btn-text');
    btn.textContent = 'Verificando...';
    document.querySelector('#form-login .btn-primary').disabled = true;

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Error al iniciar sesión.', 'error');
            return;
        }
        guardarSesion(data.token, data.usuario);
    } catch (err) {
        showToast('No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Iniciar sesión';
        document.querySelector('#form-login .btn-primary').disabled = false;
    }
}

// ─── REGISTER ─────────────────────────
async function handleRegister() {
    clearErrors('rg');

    const nombre = document.getElementById('rg-nombre').value.trim();
    const correo = document.getElementById('rg-correo').value.trim();
    const password = document.getElementById('rg-password').value;

    let valid = true;
    if (!nombre) { setError('rg', 'nombre', 'Campo obligatorio'); valid = false; }
    if (!correo) { setError('rg', 'correo', 'Campo obligatorio'); valid = false; }
    if (!password) { setError('rg', 'password', 'Campo obligatorio'); valid = false; }
    else {
        const hasMinLength = password.length >= 6;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!(hasMinLength && hasUpperCase && hasNumber && hasSpecial)) {
            setError('rg', 'password', 'No cumple todos los requisitos');
            valid = false;
        }
    }
    if (!valid) return;

    const btn = document.getElementById('rg-btn-text');
    btn.textContent = 'Creando cuenta...';
    document.querySelector('#form-register .btn-primary').disabled = true;

    try {
        const res = await fetch(`${API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Error al crear la cuenta.', 'error');
            return;
        }
        guardarSesion(data.token, data.usuario);
    } catch (err) {
        showToast('No se pudo conectar con el servidor.', 'error');
    } finally {
        btn.textContent = 'Registrarse';
        document.querySelector('#form-register .btn-primary').disabled = false;
    }
}

// ─── INVITADO ─────────────────────────
function entrarComoInvitado() {
    localStorage.removeItem('amToken');
    localStorage.removeItem('amUsuario');
    localStorage.setItem('amGuest', 'true');
    window.location.replace('index.html');
}

// ─── HELPERS ──────────────────────────
function guardarSesion(token, usuario) {
    localStorage.setItem('amToken', token);
    localStorage.setItem('amUsuario', JSON.stringify(usuario));
    localStorage.removeItem('amGuest');
    window.location.replace('index.html');
}

function switchTab(tab) {
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
    }
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons();
    }
}

function setError(prefix, field, msg) {
    const fg = document.getElementById(`${prefix}-fg-${field}`);
    const err = document.getElementById(`${prefix}-err-${field}`);
    if (fg) {
        fg.classList.add('has-error');
        fg.classList.remove('has-success');
    }
    if (err) err.textContent = msg;
}

function clearErrors(prefix) {
    const container = document.getElementById(`form-${prefix === 'lg' ? 'login' : 'register'}`);
    if (!container) return;
    container.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    container.querySelectorAll('.has-success').forEach(el => el.classList.remove('has-success'));
    container.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

// ─── RECUPERAR CONTRASEÑA (CON BACKEND REAL) ──────────
function recuperarContrasena(event) {
    event.preventDefault();
    document.getElementById('recovery-modal').style.display = 'flex';
    document.getElementById('recovery-email').value = '';
    document.getElementById('recovery-result').style.display = 'none';
    if (window.lucide) lucide.createIcons();
}

function closeRecoveryModal() {
    document.getElementById('recovery-modal').style.display = 'none';
    document.getElementById('recovery-email').value = '';
    document.getElementById('recovery-result').style.display = 'none';
}

async function verClave() {
    const email = document.getElementById('recovery-email').value.trim();
    const resultDiv = document.getElementById('recovery-result');
    const passwordText = document.getElementById('recovery-password-text');

    if (!email) {
        showToast('Ingresa tu correo electrónico.', 'warning');
        return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        showToast('Correo electrónico inválido.', 'error');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/recuperar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: email })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Correo no registrado.', 'error');
            resultDiv.style.display = 'none';
            return;
        }

        // Mostrar la clave real
        passwordText.textContent = data.clave;
        resultDiv.style.display = 'block';
        showToast('🔑 Clave encontrada para ' + email, 'success');

    } catch (error) {
        showToast('Error al conectar con el servidor.', 'error');
        resultDiv.style.display = 'none';
    }
}