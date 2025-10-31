-- EXECUTE ESTE SCRIPT NO SEU SUPABASE PARA ATUALIZAR A TABELA JOGOS

-- 1. Adicionar coluna numero_jogo
ALTER TABLE jogos ADD COLUMN IF NOT EXISTS numero_jogo INTEGER;

-- 2. Criar função para auto-incrementar
CREATE OR REPLACE FUNCTION set_numero_jogo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_jogo IS NULL THEN
        SELECT COALESCE(MAX(numero_jogo), 0) + 1
        INTO NEW.numero_jogo
        FROM jogos 
        WHERE sessao_id = NEW.sessao_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger
DROP TRIGGER IF EXISTS trigger_set_numero_jogo ON jogos;
CREATE TRIGGER trigger_set_numero_jogo
    BEFORE INSERT ON jogos
    FOR EACH ROW
    EXECUTE FUNCTION set_numero_jogo();

-- 4. Atualizar jogos existentes (se houver)
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

-- 5. Adicionar constraint de unicidade
ALTER TABLE jogos 
DROP CONSTRAINT IF EXISTS unique_numero_jogo_por_sessao;

ALTER TABLE jogos 
ADD CONSTRAINT unique_numero_jogo_por_sessao 
UNIQUE (sessao_id, numero_jogo);