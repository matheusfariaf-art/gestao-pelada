# 🔐 Sistema de Login e Usuários - Implementação

## ✅ **O que foi criado:**

### **Arquivos novos:**
- `login.html` - Tela de login com cadastro
- `login.css` - Estilos da tela de login
- `login.js` - Lógica de autenticação
- `usuarios.html` - Gerenciamento de usuários (apenas admin)
- `usuarios.css` - Estilos da tela de usuários
- `usuarios.js` - Lógica de gerenciamento
- `auth-protection.js` - Proteção para outras páginas
- `create-users-table.sql` - Tabela no Supabase

### **Arquivos modificados:**
- `index.html` - Adicionado botão de usuários (apenas admin)

## 🚀 **Como implementar:**

### **1. Executar SQL no Supabase:**
```sql
-- Copie todo o conteúdo do arquivo create-users-table.sql
-- Cole no SQL Editor do Supabase e execute
```

### **2. Proteger todas as páginas:**
Adicione em TODAS as páginas HTML (após database.js):
```html
<script src="auth-protection.js"></script>
```

**Páginas para proteger:**
- `fila.html`
- `partida.html`
- `sorteio.html`
- `cadastro.html`
- `estatisticas.html`
- `resultados.html`
- `regras.html`

### **3. Definir página inicial como login:**
Renomeie os arquivos:
- `index.html` → `home.html`
- `login.html` → `index.html`

Ou modifique `index.html` para redirecionar para login primeiro.

## 👤 **Credenciais padrão:**
- **Usuário**: `admin`
- **Senha**: `4231`

## 🎯 **Tipos de usuário:**

### **🔧 Admin (Você):**
- Acesso total a tudo
- Pode gerenciar usuários
- Pode criar/editar/desativar contas

### **📋 Organizador:**
- Gerencia jogos e fila
- Não pode gerenciar usuários
- Acesso às estatísticas

### **⚽ Jogador:**
- Participa dos jogos
- Vê fila e estatísticas básicas
- Não pode gerenciar nada

## 📱 **Funcionalidades:**

### **Tela de Login:**
- Login com usuário/senha
- Cadastro de novos usuários
- Diferentes tipos de acesso
- Sessão salva localmente

### **Gerenciamento de Usuários (Admin):**
- ➕ Adicionar usuários
- ✏️ Editar dados e permissões
- ❌ Desativar/ativar usuários
- 🔍 Filtrar por tipo e status
- 📊 Ver último login e estatísticas

### **Proteção automática:**
- Redireciona para login se não logado
- Mostra info do usuário nas páginas
- Esconde funcionalidades baseado no tipo
- Botão de logout em todas as páginas

## 🔒 **Segurança:**

### **Níveis de acesso:**
```
Player (1) < Organizer (2) < Admin (3)
```

### **Restrições automáticas:**
- Elementos `.admin-only` só para admins
- Elementos `.organizer-only` para organizer+
- Verificação de permissão em ações importantes

## 💡 **Como usar:**

### **1. Primeiro acesso:**
1. Execute o SQL no Supabase
2. Acesse `login.html`
3. Entre com `admin` / `4231`
4. Vá em "Usuários" para adicionar pessoas

### **2. Adicionar jogadores:**
1. Login como admin
2. Vá em "👥 Usuários"
3. "➕ Adicionar Usuário"
4. Escolha o tipo de acesso
5. Compartilhe as credenciais

### **3. Para cada jogador:**
1. Recebe usuário/senha do admin
2. Acessa o site
3. Faz login
4. Usa conforme suas permissões

## 🎮 **Fluxo completo:**
1. **Admin** (você) faz primeiro login
2. **Admin** adiciona organizadores/jogadores
3. **Todos** fazem login com suas credenciais
4. **Sistema** controla acesso automaticamente
5. **Cada um** vê apenas o que pode usar

## 🔄 **Para atualizações:**
Como tem login agora, o site pode ser hospedado em qualquer lugar e cada pessoa acessa com suas credenciais. Não há problema de várias pessoas usando ao mesmo tempo!

**Quer que eu ajude a implementar a proteção nas páginas restantes?** 🚀