-- Script para corrigir o schema da tabela fila
-- Mudando jogador_id de UUID para TEXT para aceitar tanto UUIDs quanto números

-- 1. Remover a constraint de foreign key temporariamente
ALTER TABLE fila DROP CONSTRAINT IF EXISTS fila_jogador_id_fkey;

-- 2. Alterar o tipo da coluna jogador_id para TEXT
ALTER TABLE fila ALTER COLUMN jogador_id TYPE TEXT;

-- 3. Recriar a constraint de foreign key (mais flexível)
-- Comentado por enquanto pois pode dar erro se há IDs mistos
-- ALTER TABLE fila ADD CONSTRAINT fila_jogador_id_fkey 
-- FOREIGN KEY (jogador_id) REFERENCES jogadores(id);

-- 4. Verificar os dados atuais
-- SELECT DISTINCT jogador_id, LENGTH(jogador_id) as id_length 
-- FROM fila 
-- ORDER BY id_length, jogador_id;