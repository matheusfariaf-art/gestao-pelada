// Estado da aplicação
let users = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se é admin
    const currentUser = requireAuth();
    if (currentUser && !hasPermission('admin')) {
        alert('❌ Apenas administradores podem gerenciar usuários.');
        window.location.href = 'index.html';
        return;
    }
    
    setupEventListeners();
    carregarUsuarios();
});

// Configurar event listeners
function setupEventListeners() {
    // Formulário adicionar usuário
    document.getElementById('form-adicionar').addEventListener('submit', handleAdicionarUsuario);
}

// Carregar usuários do banco
async function carregarUsuarios() {
    try {
        const { data: usuarios, error } = await client
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Erro do Supabase:', error);
            throw error;
        }
        
        users = usuarios || [];
        renderizarUsuarios();
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        mostrarErro('Erro ao carregar usuários. Verifique sua conexão e tente novamente.');
    }
}

// Renderizar lista de usuários
function renderizarUsuarios() {
    const container = document.getElementById('lista-usuarios');
    
    if (!users || users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">👤</span>
                <p>Nenhum usuário cadastrado ainda</p>
            </div>
        `;
        return;
    }
    
    const htmlContent = users.map(user => {
        // Verificar se os dados do usuário estão completos
        const nome = user.nome || user.username || 'Usuário';
        const username = user.username || 'user';
        const role = user.role || 'player';
        
        return `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-name">${nome}</div>
                    <div class="user-username">@${username}</div>
                    <div class="user-role role-${role}">${getRoleDisplayName(role)}</div>
                </div>
                <div class="user-actions">
                    <button class="user-btn btn-edit" onclick="editarUsuario('${user.id}')">
                        ✏️
                    </button>
                    <button class="user-btn btn-toggle ${user.ativo ? '' : 'activate'}" 
                            onclick="alternarStatusUsuario('${user.id}', ${!user.ativo})">
                        ${user.ativo ? '❌' : '✅'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = htmlContent;
}

// Obter nome amigável do role
function getRoleDisplayName(role) {
    const roles = {
        'admin': '🔧 Admin',
        'organizer': '📋 Organizador',
        'player': '⚽ Jogador'
    };
    return roles[role] || role;
}

// Handle adicionar usuário
async function handleAdicionarUsuario(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const senha = document.getElementById('senha').value.trim();
    const role = document.getElementById('role').value;
    
    // Validações
    if (!username || !senha || !role) {
        mostrarErro('Por favor, preencha todos os campos.');
        return;
    }
    
    if (username.length < 3) {
        mostrarErro('Nome de usuário deve ter pelo menos 3 caracteres.');
        return;
    }
    
    if (senha.length < 4) {
        mostrarErro('Senha deve ter pelo menos 4 caracteres.');
        return;
    }
    
    // Verificar se username já existe
    const usernameExists = users.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (usernameExists) {
        mostrarErro('Nome de usuário já existe. Escolha outro.');
        return;
    }
    
    // Desabilitar botão durante submissão
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="emoji">⏳</span><span>Adicionando...</span>';
    
    try {
        const { data, error } = await client
            .from('usuarios')
            .insert([{
                nome: username, // Usar username como nome também
                username: username,
                senha: senha,
                role: role,
                ativo: true
            }])
            .select();
            
        if (error) {
            if (error.code === '23505') {
                mostrarErro('Nome de usuário já existe. Escolha outro.');
                return;
            }
            throw error;
        }
        
        mostrarSucesso('✅ Usuário adicionado com sucesso!');
        
        // Limpar formulário
        document.getElementById('form-adicionar').reset();
        
        // Recarregar lista
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro ao adicionar usuário:', error);
        mostrarErro('Erro ao adicionar usuário. Tente novamente.');
    } finally {
        // Reabilitar botão
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Editar usuário (simplificado - apenas prompt)
async function editarUsuario(id) {
    const user = users.find(u => u.id === id);
    if (!user) {
        mostrarErro('Usuário não encontrado.');
        return;
    }
    
    const novoNome = prompt(`Editar nome do usuário "${user.nome}":`, user.nome);
    if (!novoNome || novoNome.trim() === '' || novoNome === user.nome) {
        return;
    }
    
    if (novoNome.trim().length < 2) {
        mostrarErro('Nome deve ter pelo menos 2 caracteres.');
        return;
    }
    
    try {
        const { error } = await client
            .from('usuarios')
            .update({ 
                nome: novoNome.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        if (error) throw error;
        
        mostrarSucesso('✅ Nome do usuário atualizado!');
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        mostrarErro('Erro ao editar usuário.');
    }
}

// Alternar status do usuário
async function alternarStatusUsuario(id, novoStatus) {
    const user = users.find(u => u.id === id);
    if (!user) {
        mostrarErro('Usuário não encontrado.');
        return;
    }
    
    // Prevenir auto-desativação do próprio admin
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    if (user.id === currentUser.id && !novoStatus) {
        mostrarErro('Você não pode desativar sua própria conta.');
        return;
    }
    
    const acao = novoStatus ? 'ativar' : 'desativar';
    const confirmacao = confirm(`Tem certeza que deseja ${acao} o usuário "${user.nome}"?`);
    if (!confirmacao) return;
    
    try {
        const { error } = await client
            .from('usuarios')
            .update({ 
                ativo: novoStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        if (error) throw error;
        
        const status = novoStatus ? 'ativado' : 'desativado';
        mostrarSucesso(`✅ Usuário ${status} com sucesso!`);
        await carregarUsuarios();
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        mostrarErro('Erro ao alterar status do usuário.');
    }
}

// Funções de utilidade
function mostrarSucesso(mensagem) {
    // Criar toast de sucesso
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = mensagem;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 15px 20px;
        border-radius: 8px;
        border: 1px solid #c3e6cb;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function mostrarErro(mensagem) {
    // Criar toast de erro
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = mensagem;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 15px 20px;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remover após 4 segundos (erro fica mais tempo)
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}