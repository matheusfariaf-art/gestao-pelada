// Script de proteção para adicionar no início de cada página
// Adicione este script em todas as páginas que precisam de autenticação

// Verificar autenticação na carga da página
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = requireAuth();
    if (currentUser) {
        console.log('✅ Usuário autenticado:', currentUser.nome, `(${currentUser.role})`);
        setupUserInterface(currentUser);
    }
});

// Verificar se usuário está logado
function requireAuth() {
    const savedUser = localStorage.getItem('pelada3_user');
    if (!savedUser) {
        redirectToLogin();
        return null;
    }
    
    try {
        const user = JSON.parse(savedUser);
        if (!user || !user.id) {
            redirectToLogin();
            return null;
        }
        return user;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('pelada3_user');
        redirectToLogin();
        return null;
    }
}

// Redirecionar para login
function redirectToLogin() {
    console.log('❌ Usuário não autenticado, redirecionando...');
    window.location.href = 'login.html';
}

// Configurar interface baseada no usuário
function setupUserInterface(user) {
    // Aplicar restrições baseadas no role
    applyRoleRestrictions(user.role);
    
    // Adicionar botão de logout
    addLogoutButton();
    
    // Remover qualquer informação de usuário que possa aparecer (exceto na tela de usuários)
    conditionalRemoveUserInfo();
}

// Função para remover qualquer informação de usuário que possa ter sido inserida
function removeUserInfoFromPage() {
    // Pular a tela de usuários completamente
    if (window.location.pathname.includes('usuarios.html')) {
        return;
    }
    
    // Remover apenas elementos de informação do usuário logado (não da lista)
    const elementsToRemove = [
        '.current-user',
        '.user-info:not(.user-item .user-info)', // Não remover user-info dentro de user-item
        '[class*="current-user"]'
    ];
    
    elementsToRemove.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            // Verificar se não está dentro de um user-item
            if (!el.closest('.user-item')) {
                el.remove();
            }
        });
    });
}

// Executar remoção apenas se não estiver na tela de usuários
function conditionalRemoveUserInfo() {
    if (!window.location.pathname.includes('usuarios.html')) {
        removeUserInfoFromPage();
    }
}

// Executar remoção periodicamente para garantir que não apareça (exceto na tela de usuários)
setInterval(conditionalRemoveUserInfo, 1000);

function addUserInfoToPage(user) {
    // Função desabilitada - não adicionar informações do usuário em nenhuma tela
    return;
}

// Verificar se o usuário pode acessar a página atual
function checkPageAccess(role) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Definir quais páginas cada role pode acessar
    const pageAccess = {
        'player': [
            'index.html',
            'fila.html',
            'estatisticas.html',
            'resultados.html',
            'partida.html'
            // Jogadores podem VER fila, resultados, estatísticas e partidas (apenas visualização)
        ],
        'organizer': [
            'index.html',
            'cadastro.html',
            'fila.html',
            'partida.html',
            'sorteio.html',
            'regras.html',
            'estatisticas.html',
            'resultados.html',
            'sumula.html'
            // Organizadores NÃO podem acessar: usuarios
        ],
        'admin': [
            // Admin pode acessar todas as páginas
            'index.html',
            'cadastro.html',
            'fila.html',
            'partida.html',
            'sorteio.html',
            'regras.html',
            'estatisticas.html',
            'resultados.html',
            'sumula.html',
            'usuarios.html'
        ]
    };
    
    const allowedPages = pageAccess[role] || pageAccess['player'];
    
    // Se a página atual não está na lista permitida, redirecionar
    if (!allowedPages.includes(currentPage)) {
        alert(`❌ Você não tem permissão para acessar esta página.\nSeu nível: ${getRoleDisplayName(role)}`);
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// Aplicar restrições baseadas no role
function applyRoleRestrictions(role) {
    // Primeiro, verificar se o usuário pode acessar esta página
    checkPageAccess(role);
    
    const restrictions = {
        'player': {
            hidden: ['.admin-only', '.organizer-only'],
            readonly: ['.admin-controls', '.organizer-controls']
        },
        'organizer': {
            hidden: ['.admin-only'],
            readonly: ['.admin-controls']
        },
        'admin': {
            hidden: [],
            readonly: [],
            shown: ['.admin-only'] // Mostrar elementos apenas para admin
        }
    };
    
    const userRestrictions = restrictions[role] || restrictions['player'];
    
    // Esconder elementos
    userRestrictions.hidden.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
        });
    });
    
    // Mostrar elementos apenas para admin
    if (userRestrictions.shown) {
        userRestrictions.shown.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'block';
            });
        });
    }
    
    // Tornar elementos somente leitura
    userRestrictions.readonly.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                el.readOnly = true;
                el.disabled = true;
            }
        });
    });
}

// Adicionar botão de logout
function addLogoutButton() {
    // Verificar se já existe
    if (document.querySelector('.logout-btn')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.textContent = '🚪 Sair';
    logoutBtn.onclick = logout;
    
    // Tentar adicionar no footer mobile
    const footer = document.querySelector('.footer-mobile .nav-mobile');
    if (footer) {
        const logoutItem = document.createElement('a');
        logoutItem.className = 'nav-item logout-item';
        logoutItem.innerHTML = '<span class="emoji">🚪</span>';
        logoutItem.onclick = logout;
        footer.appendChild(logoutItem);
    }
}

// Fazer logout
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('pelada3_user');
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}

// Verificar se usuário tem permissão específica
function hasPermission(requiredRole) {
    const currentUser = requireAuth();
    if (!currentUser) return false;
    
    const roleHierarchy = {
        'player': 1,
        'organizer': 2,
        'admin': 3
    };
    
    const userLevel = roleHierarchy[currentUser.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
}

// Obter nome de exibição do role
function getRoleDisplayName(role) {
    const roleNames = {
        'admin': '🔧 Admin',
        'organizer': '📋 Organizador',
        'player': '⚽ Jogador'
    };
    return roleNames[role] || role;
}