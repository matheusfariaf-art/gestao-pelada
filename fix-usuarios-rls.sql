-- Corrigir problema com RLS na tabela usuarios
-- Execute este script no Supabase SQL Editor

-- Desabilitar RLS (Row Level Security) para permitir acesso com autenticação customizada
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Usuários podem ver próprios dados" ON usuarios;
DROP POLICY IF EXISTS "Apenas admins podem criar usuários" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem atualizar próprios dados" ON usuarios;

-- Verificar se o usuário admin existe, se não, criar
INSERT INTO usuarios (nome, username, senha, role, ativo) VALUES 
('Administrador', 'admin', '4231', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- Confirmar que a tabela está acessível
SELECT 'Tabela usuarios configurada com sucesso!' as status;