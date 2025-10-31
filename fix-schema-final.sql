-- Corrigir schema do banco para finalização funcionar

-- 1. Adicionar coluna vitorias_consecutivas na tabela sessoes (se não existir)
ALTER TABLE sessoes 
ADD COLUMN IF NOT EXISTS vitorias_consecutivas INTEGER DEFAULT 0;

-- 2. Adicionar colunas de estatísticas na tabela jogadores (se não existirem)
ALTER TABLE jogadores 
ADD COLUMN IF NOT EXISTS jogos INTEGER DEFAULT 0;

ALTER TABLE jogadores 
ADD COLUMN IF NOT EXISTS vitorias INTEGER DEFAULT 0;

ALTER TABLE jogadores 
ADD COLUMN IF NOT EXISTS gols INTEGER DEFAULT 0;

-- 3. Verificar se a tabela fila tem a estrutura correta
-- Se não tiver coluna posicao, adicionar
ALTER TABLE fila 
ADD COLUMN IF NOT EXISTS posicao INTEGER;

-- 4. Atualizar jogadores existentes com valores padrão (se as colunas foram adicionadas)
UPDATE jogadores 
SET jogos = 0, vitorias = 0, gols = 0 
WHERE jogos IS NULL OR vitorias IS NULL OR gols IS NULL;

-- Visualizar estruturas atuais para debug:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sessoes'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'fila'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;