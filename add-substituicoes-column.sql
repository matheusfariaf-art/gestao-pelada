-- Adicionar coluna para armazenar substituições realizadas durante a partida
-- Execute este script no Supabase SQL Editor

-- Verificar se a coluna já existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jogos' 
        AND column_name = 'substituicoes'
    ) THEN
        -- Adicionar coluna substituicoes como JSONB
        ALTER TABLE jogos 
        ADD COLUMN substituicoes JSONB DEFAULT '[]'::jsonb;
        
        RAISE NOTICE 'Coluna substituicoes adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna substituicoes já existe.';
    END IF;
END $$;

-- Comentário da coluna para documentação
COMMENT ON COLUMN jogos.substituicoes IS 'Array JSON das substituições realizadas durante a partida. Cada substituição contém: jogador_saiu, jogador_entrou, momento, tempo_jogo, posicao_fila';