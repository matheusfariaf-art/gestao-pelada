-- Script para atualizar a tabela jogos
-- Adicionar coluna numero_jogo para facilitar identificação sequencial

-- 1. Adicionar a coluna numero_jogo
ALTER TABLE jogos 
ADD COLUMN numero_jogo INTEGER;

-- 2. Criar função para auto-incrementar numero_jogo por sessão
CREATE OR REPLACE FUNCTION set_numero_jogo()
RETURNS TRIGGER AS $$
BEGIN
    -- Buscar o próximo número sequencial para esta sessão
    SELECT COALESCE(MAX(numero_jogo), 0) + 1
    INTO NEW.numero_jogo
    FROM jogos 
    WHERE sessao_id = NEW.sessao_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para executar antes de inserir
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

-- 5. Adicionar constraint para garantir unicidade por sessão
ALTER TABLE jogos 
ADD CONSTRAINT unique_numero_jogo_por_sessao 
UNIQUE (sessao_id, numero_jogo);

-- 6. Comentário sobre a nova estrutura
COMMENT ON COLUMN jogos.numero_jogo IS 'Número sequencial do jogo dentro da sessão (1, 2, 3...)';