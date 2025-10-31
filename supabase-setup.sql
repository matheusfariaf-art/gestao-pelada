-- Tabela de Jogadores
CREATE TABLE jogadores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    nivel_habilidade INTEGER CHECK (nivel_habilidade >= 1 AND nivel_habilidade <= 10)
);

-- Tabela de Sessões (cada dia de pelada)
CREATE TABLE sessoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa', 'finalizada')),
    total_jogadores INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Regras (configurações da pelada)
CREATE TABLE regras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    duracao INTEGER DEFAULT 10, -- Duração da partida em minutos
    jogadores_por_time INTEGER DEFAULT 6, -- Quantidade de jogadores por time
    limite_jogadores INTEGER DEFAULT 30, -- Limite máximo de jogadores na pelada
    vitorias_consecutivas INTEGER DEFAULT 3, -- Quantidade de vitórias consecutivas para regra especial
    prioridade_retorno BOOLEAN DEFAULT true, -- Prioridade de retorno após 3 vitórias (true = vai na frente do time perdedor)
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela da Fila (controle de quem joga)
CREATE TABLE fila (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sessao_id UUID REFERENCES sessoes(id) ON DELETE CASCADE,
    jogador_id UUID REFERENCES jogadores(id),
    status VARCHAR(20) DEFAULT 'reserva' CHECK (status IN ('fila', 'reserva')),
    posicao_fila INTEGER,
    vitorias_consecutivas_time INTEGER DEFAULT 0, -- Vitórias seguidas do time atual (zera ao perder/empatar/chegar a 3)
    jogos_jogados INTEGER DEFAULT 0, -- Jogos jogados na sessão
    vitorias INTEGER DEFAULT 0, -- Vitórias na sessão
    gols INTEGER DEFAULT 0, -- Gols na sessão
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Jogos (cada partida)
CREATE TABLE jogos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sessao_id UUID REFERENCES sessoes(id) ON DELETE CASCADE,
    numero_jogo INTEGER, -- Número sequencial do jogo na sessão (1, 2, 3...)
    time_a JSONB NOT NULL, -- Array com IDs dos jogadores do time A
    time_b JSONB NOT NULL, -- Array com IDs dos jogadores do time B
    placar_a INTEGER DEFAULT 0,
    placar_b INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizado', 'pausado')),
    tempo_decorrido INTEGER DEFAULT 0, -- em segundos
    time_vencedor CHAR(1), -- A, B, ou null para empate
    data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fim TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sessao_id, numero_jogo) -- Garantir unicidade por sessão
);

-- Tabela de Gols (estatísticas individuais)
CREATE TABLE gols (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jogo_id UUID REFERENCES jogos(id) ON DELETE CASCADE,
    jogador_id UUID REFERENCES jogadores(id) NOT NULL,
    time CHAR(1) NOT NULL CHECK (time IN ('A', 'B')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir regras padrão
INSERT INTO regras (duracao, jogadores_por_time, limite_jogadores, vitorias_consecutivas, prioridade_retorno) 
VALUES (10, 6, 30, 3, true);

-- Função para auto-incrementar numero_jogo por sessão
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

-- Trigger para executar antes de inserir
CREATE TRIGGER trigger_set_numero_jogo
    BEFORE INSERT ON jogos
    FOR EACH ROW
    EXECUTE FUNCTION set_numero_jogo();

-- Índices para melhor performance
CREATE INDEX idx_jogadores_nome ON jogadores(nome);
CREATE INDEX idx_sessoes_data ON sessoes(data);
CREATE INDEX idx_sessoes_status ON sessoes(status);
CREATE INDEX idx_fila_sessao ON fila(sessao_id);
CREATE INDEX idx_fila_posicao ON fila(posicao_fila);
CREATE INDEX idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX idx_jogos_status ON jogos(status);
CREATE INDEX idx_gols_jogo ON gols(jogo_id);
CREATE INDEX idx_gols_jogador ON gols(jogador_id);

-- RLS (Row Level Security) - Configurações de segurança
ALTER TABLE jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gols ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir tudo para simplificar - ajuste conforme necessário)
CREATE POLICY "Permitir tudo para todos" ON jogadores USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para todos" ON sessoes USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para todos" ON regras USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para todos" ON fila USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para todos" ON jogos USING (true) WITH CHECK (true);
CREATE POLICY "Permitir tudo para todos" ON gols USING (true) WITH CHECK (true);