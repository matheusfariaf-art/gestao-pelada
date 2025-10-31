-- Criar tabela de usuários
CREATE TABLE usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL, -- Em produção, usar hash bcrypt
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'organizer', 'player')),
    ativo BOOLEAN DEFAULT true,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_role ON usuarios(role);
CREATE INDEX idx_usuarios_ativo ON usuarios(ativo);

-- Inserir usuário admin padrão (senha: 4231)
INSERT INTO usuarios (nome, username, senha, role, ativo) VALUES 
('Administrador', 'admin', '4231', 'admin', true);

-- Criar política RLS (Row Level Security) - DESABILITADA para autenticação customizada
-- ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Para autenticação customizada, vamos desabilitar RLS por enquanto
-- As políticas de segurança serão implementadas no código JavaScript

-- Política: Usuários podem ver apenas seus próprios dados (exceto admins)
-- CREATE POLICY "Usuários podem ver próprios dados" ON usuarios
--     FOR SELECT USING (
--         auth.uid() = id OR 
--         EXISTS (
--             SELECT 1 FROM usuarios 
--             WHERE id = auth.uid() AND role = 'admin'
--         )
--     );

-- Política: Apenas admins podem inserir novos usuários
-- CREATE POLICY "Apenas admins podem criar usuários" ON usuarios
--     FOR INSERT WITH CHECK (
--         EXISTS (
--             SELECT 1 FROM usuarios 
--             WHERE id = auth.uid() AND role = 'admin'
--         )
--     );

-- Política: Usuários podem atualizar próprios dados, admins podem atualizar todos
-- CREATE POLICY "Usuários podem atualizar próprios dados" ON usuarios
--     FOR UPDATE USING (
--         auth.uid() = id OR 
--         EXISTS (
--             SELECT 1 FROM usuarios 
--             WHERE id = auth.uid() AND role = 'admin'
--         )
--     );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_usuarios_updated_at 
    BEFORE UPDATE ON usuarios 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE usuarios IS 'Tabela de usuários do sistema com diferentes níveis de acesso';
COMMENT ON COLUMN usuarios.role IS 'Tipos: admin (acesso total), organizer (gerencia jogos), player (participa)';
COMMENT ON COLUMN usuarios.ativo IS 'Flag para desativar usuário sem deletar do banco';