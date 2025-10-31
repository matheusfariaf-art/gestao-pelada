-- Script para corrigir o schema da tabela jogadores
-- Mudando id de UUID para TEXT para aceitar tanto UUIDs quanto números

-- 1. Verificar tipos de dados atuais (comentado para execução mais rápida)
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'jogadores' AND table_schema = 'public';

-- 2. Remover todas as foreign keys que referenciam jogadores.id
ALTER TABLE gols DROP CONSTRAINT IF EXISTS gols_jogador_id_fkey;
ALTER TABLE fila DROP CONSTRAINT IF EXISTS fila_jogador_id_fkey;

-- 3. Alterar colunas relacionadas para TEXT também
ALTER TABLE gols ALTER COLUMN jogador_id TYPE TEXT;
-- (fila já foi alterada no script anterior)

-- 4. Alterar a coluna principal
ALTER TABLE jogadores ALTER COLUMN id TYPE TEXT;

-- 5. Recriar as foreign keys (comentado por enquanto para evitar conflitos)
-- ALTER TABLE gols ADD CONSTRAINT gols_jogador_id_fkey 
-- FOREIGN KEY (jogador_id) REFERENCES jogadores(id);

-- 6. Verificar todos os tipos de IDs
SELECT id, nome, LENGTH(id) as id_length, 
       CASE 
           WHEN id ~ '^[0-9]+$' THEN 'numeric' 
           WHEN id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN 'uuid'
           ELSE 'other'
       END as id_type
FROM jogadores 
ORDER BY id_length, id;

-- 7. Verificar se existe jogador com ID "1"
SELECT * FROM jogadores WHERE id = '1';

-- 8. Verificar se há algum jogador com ID numérico
SELECT * FROM jogadores WHERE id ~ '^[0-9]+$' LIMIT 5;