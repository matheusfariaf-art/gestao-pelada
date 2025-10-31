-- ========================================
-- ATUALIZAÇÃO APENAS DA TABELA JOGOS
-- Execute este SQL no Supabase SQL Editor
-- ========================================

-- 1. Adicionar coluna numero_jogo (se não existir)
ALTER TABLE jogos ADD COLUMN IF NOT EXISTS numero_jogo INTEGER;

-- 2. Função para auto-incrementar numero_jogo por sessão
CREATE OR REPLACE FUNCTION set_numero_jogo()
RETURNS TRIGGER AS $$
BEGIN
    -- Se numero_jogo não foi definido, calcular automaticamente
    IF NEW.numero_jogo IS NULL THEN
        SELECT COALESCE(MAX(numero_jogo), 0) + 1
        INTO NEW.numero_jogo
        FROM jogos 
        WHERE sessao_id = NEW.sessao_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Remover trigger antigo (se existir) e criar novo
DROP TRIGGER IF EXISTS trigger_set_numero_jogo ON jogos;
CREATE TRIGGER trigger_set_numero_jogo
    BEFORE INSERT ON jogos
    FOR EACH ROW
    EXECUTE FUNCTION set_numero_jogo();

-- 4. Atualizar jogos existentes com numeração sequencial
WITH numbered_games AS (
    SELECT 
        id,
        sessao_id,
        ROW_NUMBER() OVER (PARTITION BY sessao_id ORDER BY created_at) as game_number
    FROM jogos
    WHERE numero_jogo IS NULL
)
UPDATE jogos 
SET numero_jogo = numbered_games.game_number
FROM numbered_games
WHERE jogos.id = numbered_games.id;

-- 5. Garantir unicidade (um número por sessão)
ALTER TABLE jogos 
DROP CONSTRAINT IF EXISTS unique_numero_jogo_por_sessao;

ALTER TABLE jogos 
ADD CONSTRAINT unique_numero_jogo_por_sessao 
UNIQUE (sessao_id, numero_jogo);

-- 6. Verificar se funcionou
SELECT 
    sessao_id,
    numero_jogo,
    status,
    created_at
FROM jogos 
ORDER BY sessao_id, numero_jogo;