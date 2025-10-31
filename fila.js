// Estado global da fila
let gameState = {
    currentGame: {
        time1: [],
        time2: [],
        gameNumber: 1,
        consecutiveWins: 0,
        lastWinner: null
    },
    queue: [],
    reserves: [],
    sessaoAtiva: null
};

// Função para exibir a data atual
function exibirDataAtual() {
    const dataAtual = new Date();
    
    // Obter dia da semana
    const diaSemana = dataAtual.toLocaleDateString('pt-BR', { weekday: 'long' });
    
    // Obter data no formato DD/MM/AAAA
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    
    const dataFormatada = `${diaSemana}, ${dia}/${mes}/${ano}`;
    
    const elementoData = document.getElementById('data-atual');
    if (elementoData) {
        elementoData.textContent = dataFormatada;
    }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    // Exibir data atual
    exibirDataAtual();
    
    // Aplicar restrições visuais para jogadores
    aplicarRestricoesVisuais();
    
    // Aguardar um pouco para garantir que o Supabase foi carregado
    setTimeout(() => {
        initializePage();
    }, 100);
    
    // Recarregar fila automaticamente quando a janela ganha foco (usuário volta da partida)
    window.addEventListener('focus', () => {
        console.log('🔄 Janela ganhou foco - recarregando fila...');
        setTimeout(() => {
            recarregarFila();
        }, 500);
    });

    // Event listeners para tela sem sessão
    const goToSorteioBtn = document.getElementById('go-to-sorteio-btn');
    const refreshQueueBtn = document.getElementById('refresh-queue-btn');
    
    if (goToSorteioBtn) {
        goToSorteioBtn.addEventListener('click', () => {
            window.location.href = 'sorteio.html';
        });
    }
    
    if (refreshQueueBtn) {
        refreshQueueBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
});

// Função para recarregar apenas a fila
async function recarregarFila() {
    try {
        console.log('🔄 Recarregando dados da fila...');
        
        // Verificar se há uma sessão ativa
        const sessao = await obterSessaoAtiva();
        if (!sessao) {
            console.log('❌ Não há sessão ativa');
            return;
        }
        
        gameState.sessaoAtiva = sessao;
        
        // Buscar último jogo para atualizar times atuais
        const jogos = await obterJogos(sessao.id);
        const ultimoJogo = jogos.find(j => j.status === 'iniciado');
        
        if (ultimoJogo) {
            gameState.currentGame.time1 = ultimoJogo.time_a || [];
            gameState.currentGame.time2 = ultimoJogo.time_b || [];
            gameState.currentGame.gameNumber = ultimoJogo.numero_jogo || jogos.length;
        }
        
        // Recarregar fila
        const fila = await obterFila(sessao.id);
        gameState.queue = fila.sort((a, b) => a.posicao_fila - b.posicao_fila);
        
        // Recarregar reservas
        const todosJogadores = await obterJogadores();
        const jogandoIds = [
            ...gameState.currentGame.time1.map(p => p.id),
            ...gameState.currentGame.time2.map(p => p.id)
        ];
        const filaIds = gameState.queue.map(p => p.jogador_id);
        
        gameState.reserves = todosJogadores.filter(j => 
            !jogandoIds.includes(j.id) && !filaIds.includes(j.id)
        );
        
        // Renderizar interface atualizada
        await renderGameInterface();
        
        console.log('✅ Fila recarregada com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao recarregar fila:', error);
    }
}

async function initializePage() {
    try {
        // Verificar se há uma sessão ativa
        const sessao = await obterSessaoAtiva();
        console.log('🔍 Sessão encontrada:', sessao);
        
        if (!sessao) {
            console.log('❌ Não há sessão ativa - mostrando tela de sessão vazia');
            // Não há sessão ativa, mostrar tela especial
            showNoSessionScreen();
            return;
        }

        gameState.sessaoAtiva = sessao;
        
        // Carregar estado atual do jogo
        await loadGameState();
        
        // Renderizar interface
        await renderGameInterface();
        
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
        showError('Erro ao carregar dados do jogo');
    }
}

async function loadGameState() {
    try {
        // Buscar times jogando atual
        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        const ultimoJogo = jogos.length > 0 ? jogos[jogos.length - 1] : null;
        
        if (ultimoJogo && ultimoJogo.status === 'em_andamento') {
            // Há um jogo em andamento
            gameState.currentGame.time1 = ultimoJogo.time_a || [];
            gameState.currentGame.time2 = ultimoJogo.time_b || [];
            gameState.currentGame.gameNumber = ultimoJogo.numero_jogo || jogos.length;
        }
        
        // Buscar fila
        const fila = await obterFila(gameState.sessaoAtiva.id);
        gameState.queue = fila.sort((a, b) => a.posicao_fila - b.posicao_fila);
        
        // Buscar reservas (jogadores não na fila nem jogando)
        const todosJogadores = await obterJogadores();
        
        const jogandoIds = [
            ...gameState.currentGame.time1.map(p => p.id),
            ...gameState.currentGame.time2.map(p => p.id)
        ];
        const filaIds = gameState.queue.map(p => p.jogador_id);
        
        gameState.reserves = todosJogadores.filter(j => 
            !jogandoIds.includes(j.id) && !filaIds.includes(j.id)
        );
        

        
        // Calcular vitórias consecutivas
        await calculateConsecutiveWins();
        
    } catch (error) {
        console.error('Erro ao carregar estado do jogo:', error);
        throw error;
    }
}

async function calculateConsecutiveWins() {
    try {
        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        const jogosFinalizados = jogos.filter(j => j.status === 'finalizado');
        
        if (jogosFinalizados.length === 0) {
            gameState.currentGame.consecutiveWins = 0;
            gameState.currentGame.lastWinner = null;
            return;
        }
        
        // Buscar o último vencedor
        const ultimoJogo = jogosFinalizados[jogosFinalizados.length - 1];
        const lastWinner = ultimoJogo.time_vencedor;
        
        if (!lastWinner) {
            gameState.currentGame.consecutiveWins = 0;
            gameState.currentGame.lastWinner = null;
            return;
        }
        
        // Contar vitórias consecutivas do mesmo time
        let consecutiveWins = 0;
        for (let i = jogosFinalizados.length - 1; i >= 0; i--) {
            const jogo = jogosFinalizados[i];
            if (jogo.time_vencedor === lastWinner) {
                consecutiveWins++;
            } else {
                break;
            }
        }
        
        gameState.currentGame.consecutiveWins = consecutiveWins;
        gameState.currentGame.lastWinner = lastWinner;
        
    } catch (error) {
        console.error('Erro ao calcular vitórias consecutivas:', error);
    }
}

async function renderGameInterface() {
    // Atualizar informações do cabeçalho
    updateHeaderInfo();
    
    // Renderizar times próximos (já calcula stats no cache)
    await renderNextTeams();
    
    // Renderizar fila de espera (agora as stats já estão no cache)
    await renderQueueTable();
    
    // Renderizar reservas
    renderReserves();
    
    // Carregar estatísticas do dia
    await carregarEstatisticasDia();
}

function updateHeaderInfo() {
    const LIMITE_FILA = 30;
    const queueSize = gameState.queue.length;
    
    // Atualizar contador de jogadores
    const totalJogadores = document.getElementById('total-jogadores');
    if (totalJogadores) {
        totalJogadores.textContent = `${queueSize}/${LIMITE_FILA} jogadores na fila`;
        
        // Adicionar classe de aviso quando próximo do limite
        if (queueSize >= LIMITE_FILA * 0.9) {
            totalJogadores.style.color = '#ff4444';
        } else if (queueSize >= LIMITE_FILA * 0.8) {
            totalJogadores.style.color = '#ff8800';
        } else {
            totalJogadores.style.color = '';
        }
    }
}

// Função para calcular estatísticas de um jogador
// Função para obter data de hoje em formato YYYY-MM-DD
function getDataHoje() {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
}

async function calcularEstatisticasJogador(jogadorId) {
    try {
        const dataHoje = getDataHoje();
        console.log(`� Calculando estatísticas do dia ${dataHoje} para jogador ${jogadorId}`);
        
        // Para estatísticas diárias, sempre calcular dos jogos do dia
        // (não usar tabela jogadores que tem estatísticas gerais)
        
        if (!gameState.sessaoAtiva) {
            return { jogos: 0, vitorias: 0, gols: 0 };
        }

        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        
        // Filtrar apenas jogos do dia atual
        const jogosFinalizados = jogos.filter(j => {
            if (j.status !== 'finalizado') return false;
            
            // Converter created_at para data local e comparar
            const jogoData = new Date(j.created_at).toISOString().split('T')[0];
            return jogoData === dataHoje;
        });
        
        console.log(`📅 Encontrados ${jogosFinalizados.length} jogos finalizados do dia ${dataHoje}`);
        
        let estatisticas = {
            jogos: 0,
            vitorias: 0,
            gols: 0
        };
        
        // Calcular estatísticas dos jogos do dia
        for (const jogo of jogosFinalizados) {
            const time1 = jogo.time_a || [];
            const time2 = jogo.time_b || [];
            
            const jogouTime1 = time1.includes(jogadorId);
            const jogouTime2 = time2.includes(jogadorId);
            
            if (jogouTime1 || jogouTime2) {
                estatisticas.jogos++;
                
                if (jogo.time_vencedor) {
                    const venceuTime1 = jogo.time_vencedor === 'A' && jogouTime1;
                    const venceuTime2 = jogo.time_vencedor === 'B' && jogouTime2;
                    
                    if (venceuTime1 || venceuTime2) {
                        estatisticas.vitorias++;
                    }
                }
            }
        }
        
        // Buscar gols do dia
        const jogoIds = jogosFinalizados.map(j => j.id);
        if (jogoIds.length > 0) {
            const gols = await obterGolsJogador(jogadorId, jogoIds);
            estatisticas.gols = gols.length;
        }
        
        console.log(`📊 Estatísticas do dia para jogador ${jogadorId}:`, estatisticas);
        return estatisticas;
        
    } catch (error) {
        console.error('Erro ao calcular estatísticas:', error);
        return { jogos: 0, vitorias: 0, gols: 0 };
    }
}



// Cache para estatísticas dos jogadores
let statsCache = new Map();

// Função para renderizar os próximos times
async function renderNextTeams() {
    // Limpar cache para nova renderização
    statsCache.clear();
    
    // Pré-calcular estatísticas de todos os jogadores na fila
    await preCalculateStats();
    
    await renderTeam(1, 0, 6);  // Time 1: posições 0-5
    await renderTeam(2, 6, 12); // Time 2: posições 6-11
}

// Função para pré-calcular todas as estatísticas
async function preCalculateStats() {
    const allPlayerIds = gameState.queue.map(p => p.jogador_id);
    
    for (const playerId of allPlayerIds) {
        if (!statsCache.has(playerId)) {
            const stats = await calcularEstatisticasJogador(playerId);
            statsCache.set(playerId, stats);
        }
    }
}

// Função para renderizar um time específico
async function renderTeam(teamNumber, startIndex, endIndex) {
    const tbody = document.getElementById(`team${teamNumber}-body`);
    if (!tbody) return;
    
    const teamPlayers = gameState.queue.slice(startIndex, endIndex);
    
    // Preencher com slots vazios se necessário
    while (teamPlayers.length < 6) {
        teamPlayers.push(null);
    }
    
    let html = '';
    for (let i = 0; i < teamPlayers.length; i++) {
        const player = teamPlayers[i];
        
        if (player) {
            const stats = statsCache.get(player.jogador_id) || { jogos: 0, vitorias: 0, gols: 0 };
            html += `
                <tr>
                    <td class="player-name-cell">${player.nome || player.jogador?.nome}</td>
                    <td class="stat-cell">${stats.jogos}</td>
                    <td class="stat-cell">${stats.vitorias}</td>
                    <td class="stat-cell">${stats.gols}</td>
                </tr>
            `;
        } else {
            html += `
                <tr class="empty-row">
                    <td class="player-name-cell">Aguardando jogador...</td>
                    <td class="stat-cell">-</td>
                    <td class="stat-cell">-</td>
                    <td class="stat-cell">-</td>
                </tr>
            `;
        }
    }
    
    tbody.innerHTML = html;
}

// Função para renderizar a tabela da fila de espera
async function renderQueueTable() {
    const tbody = document.getElementById('queue-body');
    const queueCount = document.getElementById('queue-count');
    
    if (queueCount) {
        const remainingInQueue = Math.max(0, gameState.queue.length - 12);
        queueCount.textContent = `${remainingInQueue} aguardando`;
    }
    
    if (!tbody) return;
    
    // Jogadores a partir da posição 13 (índice 12)
    const waitingPlayers = gameState.queue.slice(12);
    
    if (waitingPlayers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state" style="text-align: center; padding: 40px;">
                    <span class="emoji" style="font-size: 2rem; display: block; margin-bottom: 10px;">✅</span>
                    <strong>Todos organizados!</strong><br>
                    <small style="color: #666;">Próximos 12 jogadores já estão nos times</small>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    for (let i = 0; i < waitingPlayers.length; i++) {
        const player = waitingPlayers[i];
        const stats = statsCache.get(player.jogador_id) || { jogos: 0, vitorias: 0, gols: 0 };
        
        html += `
            <tr>
                <td class="player-name-cell">${player.nome || player.jogador?.nome}</td>
                <td class="stat-cell">${stats.jogos}</td>
                <td class="stat-cell">${stats.vitorias}</td>
                <td class="stat-cell">${stats.gols}</td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
}

function renderReserves() {
    // Elemento removido da interface - não precisa mais renderizar reserves na tela principal
    // Reserves agora são acessadas apenas via modal
    return;
    
    if (gameState.reserves.length === 0) {
        reservesList.innerHTML = `
            <div class="empty-state">
                <span class="emoji">✅</span>
                <h3>Todos na fila!</h3>
                <p>Todos os jogadores estão jogando ou na fila</p>
            </div>
        `;
        return;
    }
    
    reservesList.innerHTML = gameState.reserves.map(player => `
        <div class="reserve-item">
            <span class="reserve-name">${player.nome}</span>
            <button class="btn-add-queue" onclick="addPlayerToQueue(${player.id})">
                Adicionar
            </button>
        </div>
    `).join('');
}

async function addPlayerToQueue(playerId) {
    try {
        const player = gameState.reserves.find(p => p.id === playerId);
        if (!player) return;
        
        // Adicionar à fila no banco
        await adicionarJogadorFila(gameState.sessaoAtiva.id, playerId);
        
        // Atualizar estado local
        gameState.reserves = gameState.reserves.filter(p => p.id !== playerId);
        gameState.queue.push({
            jogador_id: playerId,
            nome: player.nome,
            posicao_fila: gameState.queue.length + 1
        });
        
        // Re-renderizar
        renderQueue();
        renderReserves();
        
    } catch (error) {
        console.error('Erro ao adicionar jogador à fila:', error);
        showError('Erro ao adicionar jogador à fila');
    }
}

// Funções de gerenciamento de jogos removidas - serão implementadas em tela separada

function showTieModal() {
    const modal = document.getElementById('tieModal');
    const tieOptions = document.getElementById('tieOptions');
    
    // Limpar opções anteriores
    tieOptions.innerHTML = '';
    
    // Adicionar jogadores dos dois times
    const allPlayers = [...gameState.currentGame.time1, ...gameState.currentGame.time2];
    
    allPlayers.forEach(player => {
        const button = document.createElement('button');
        button.className = 'btn-secondary';
        button.style.marginBottom = '8px';
        button.onclick = () => selectTieBreaker(player.id, player.nome);
        button.innerHTML = `${player.nome} <small>(${getPlayerPosition(player.posicao)})</small>`;
        tieOptions.appendChild(button);
    });
    
    modal.style.display = 'flex';
}

async function selectTieBreaker(playerId, playerName) {
    try {
        // Determinar de qual time é o jogador
        const isTeam1 = gameState.currentGame.time1.some(p => p.id === playerId);
        const winner = isTeam1 ? 'time1' : 'time2';
        
        closeModal('tieModal');
        
        // Registrar resultado com critério de desempate
        await processGameResult(winner, playerId, playerName);
        
    } catch (error) {
        console.error('Erro ao processar desempate:', error);
        showError('Erro ao processar desempate');
    }
}

async function processGameResult(winner, tieBreakerId = null, tieBreakerName = null) {
    try {
        // Salvar resultado no banco
        await salvarResultadoJogo(
            gameState.sessaoAtiva.id,
            gameState.currentGame.gameNumber,
            winner,
            tieBreakerId
        );
        
        // Atualizar vitórias consecutivas
        const sameWinner = gameState.currentGame.lastWinner === winner;
        const newConsecutiveWins = sameWinner ? gameState.currentGame.consecutiveWins + 1 : 1;
        
        // Reorganizar fila baseado na regra
        await reorganizeQueue(winner, newConsecutiveWins);
        
        // Preparar próximo jogo
        await setupNextGame(winner, newConsecutiveWins);
        
        // Re-renderizar interface
        await renderGameInterface();
        
        // Mostrar mensagem de sucesso
        const message = tieBreakerId ? 
            `Resultado registrado! ${tieBreakerName} decidiu o jogo.` :
            `Resultado registrado! ${winner === 'time1' ? 'Time 1' : 'Time 2'} venceu.`;
        
        showSuccess(message);
        
    } catch (error) {
        console.error('Erro ao processar resultado:', error);
        throw error;
    }
}

async function reorganizeQueue(winner, consecutiveWins) {
    const losingTeam = winner === 'time1' ? gameState.currentGame.time2 : gameState.currentGame.time1;
    
    if (consecutiveWins >= 3) {
        // 3ª vitória consecutiva: time perdedor vai para o início da fila
        await moveTeamToFrontOfQueue(losingTeam);
    } else {
        // Vitória normal ou 2ª consecutiva: time perdedor vai para o final da fila
        await moveTeamToBackOfQueue(losingTeam);
    }
}

async function moveTeamToFrontOfQueue(team) {
    try {
        // Limpar fila atual
        await limparFila(gameState.sessaoAtiva.id);
        
        // Adicionar time perdedor no início
        for (let i = 0; i < team.length; i++) {
            await adicionarJogadorFila(gameState.sessaoAtiva.id, team[i].id, i + 1);
        }
        
        // Adicionar resto da fila
        for (let i = 0; i < gameState.queue.length; i++) {
            const position = i + team.length + 1;
            await adicionarJogadorFila(gameState.sessaoAtiva.id, gameState.queue[i].jogador_id, position);
        }
        
    } catch (error) {
        console.error('Erro ao mover time para início da fila:', error);
        throw error;
    }
}

async function moveTeamToBackOfQueue(team) {
    try {
        // Adicionar time perdedor no final da fila
        for (let i = 0; i < team.length; i++) {
            const position = gameState.queue.length + i + 1;
            await adicionarJogadorFila(gameState.sessaoAtiva.id, team[i].id, position);
        }
        
    } catch (error) {
        console.error('Erro ao mover time para final da fila:', error);
        throw error;
    }
}

async function setupNextGame(winner, consecutiveWins) {
    const winningTeam = winner === 'time1' ? gameState.currentGame.time1 : gameState.currentGame.time2;
    
    // Time vencedor continua jogando
    // Próximos 5 da fila entram para formar novo time adversário
    const nextPlayers = gameState.queue.slice(0, 5);
    
    if (nextPlayers.length < 5) {
        // Não há jogadores suficientes na fila
        showError('Não há jogadores suficientes na fila para o próximo jogo');
        return;
    }
    
    // Criar novo jogo
    const newGame = {
        time1: winningTeam,
        time2: nextPlayers.map(p => ({
            id: p.jogador_id,
            nome: p.nome || p.jogador?.nome,
            nivel_habilidade: p.jogador?.nivel_habilidade || 5
        })),
        gameNumber: gameState.currentGame.gameNumber + 1,
        consecutiveWins: consecutiveWins,
        lastWinner: winner
    };
    
    // Salvar novo jogo no banco
    // await criarNovoJogo_OLD(gameState.sessaoAtiva.id, newGame); // Função removida
    
    // Remover jogadores da fila que entraram no jogo
    for (const player of nextPlayers) {
        await removerJogadorFila(gameState.sessaoAtiva.id, player.jogador_id);
    }
    
    // Atualizar estado local
    gameState.currentGame = newGame;
    gameState.queue = gameState.queue.slice(5); // Remover os 5 primeiros
}

// Função removida - usando a do database.js

async function salvarResultadoJogo(sessaoId, numeroJogo, vencedor, tieBreakerId = null) {
    try {
        // Determinar o time vencedor no formato A/B
        let timeVencedor = null;
        if (vencedor === 'time1') {
            timeVencedor = 'A';
        } else if (vencedor === 'time2') {
            timeVencedor = 'B';
        }
        
        const { data, error } = await client
            .from('jogos')
            .update({
                status: 'finalizado',
                time_vencedor: timeVencedor,
                data_fim: new Date().toISOString()
            })
            .eq('sessao_id', sessaoId)
            .eq('numero_jogo', numeroJogo);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao salvar resultado:', error);
        throw error;
    }
}



function showEmptyState() {
    document.querySelector('.main').innerHTML = `
        <div class="container">
            <div class="empty-state">
                <span class="emoji">🏁</span>
                <h3>Nenhum jogo ativo</h3>
                <p>Inicie uma nova pelada na tela de sorteio</p>
                <button class="btn-primary" onclick="window.location.href='sorteio.html'">
                    <span>⚽</span>
                    <span>Ir para Sorteio</span>
                </button>
                <br><br>
                <button class="btn-secondary" onclick="criarSessaoTeste()" style="background: #ff6b35; margin-top: 10px;">
                    <span>🔧</span>
                    <span>Criar Sessão de Teste</span>
                </button>
            </div>
        </div>
    `;
}

// Função para criar sessão de teste
async function criarSessaoTeste() {
    try {
        console.log('🔧 Criando sessão de teste...');
        
        const novaSessao = {
            data_sessao: new Date().toISOString().split('T')[0],
            local: 'Campo de Teste',
            status: 'ativa'
        };
        
        const resultado = await Database.criarSessao(novaSessao);
        
        if (resultado.success) {
            console.log('✅ Sessão de teste criada:', resultado.data);
            alert('✅ Sessão de teste criada! Recarregando página...');
            location.reload();
        } else {
            console.error('❌ Erro ao criar sessão:', resultado.error);
            alert('❌ Erro ao criar sessão: ' + resultado.error);
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar sessão de teste:', error);
        alert('❌ Erro: ' + error.message);
    }
}

function showError(message) {
    // Implementar sistema de notificação de erro
    alert(message);
}

function showSuccess(message) {
    // Implementar sistema de notificação de sucesso
    alert(message);
}

async function endSession() {
    if (!confirm('Tem certeza que deseja encerrar a sessão? Todos os dados serão mantidos.')) {
        return;
    }
    
    try {
        // Finalizar sessão ativa
        await finalizarSessao(gameState.sessaoAtiva.id);
        
        // Redirecionar para página inicial
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Erro ao encerrar sessão:', error);
        showError('Erro ao encerrar sessão');
    }
}

async function finalizarSessao(sessaoId) {
    try {
        const { data, error } = await client
            .from('sessoes')
            .update({
                finalizada: true,
                finalizada_em: new Date().toISOString()
            })
            .eq('id', sessaoId);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao finalizar sessão:', error);
        throw error;
    }
}

// ========== SISTEMA DE GERENCIAMENTO DE JOGADORES ==========

// Estado do gerenciamento
let managementState = {
    operacao: null, // 'adicionar', 'remover', 'substituir'
    jogadorSaindo: null,
    posicaoSubstituicao: null,
    jogadoresSelecionados: []
};

// Função para mostrar opções de gerenciamento
function mostrarOpcoesGerenciamento() {
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
    }
}

// Função para mostrar painel de gerenciamento
function mostrarGerenciamento() {
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.style.display = 'flex';
        
        // Adicionar listener para fechar clicando no fundo
        painel.onclick = function(e) {
            if (e.target === painel) {
                fecharGerenciamento();
            }
        };
    }
}

// Função para fechar painel de gerenciamento
function fecharGerenciamento() {
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.style.display = 'none';
    }
}

// Função para fechar qualquer modal
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Não resetar estado se estamos no meio de uma substituição
    if (managementState.operacao === 'substituir' && managementState.jogadorSaindo) {
        return;
    }
    
    // Resetar estado
    managementState = {
        operacao: null,
        jogadorSaindo: null,
        posicaoSubstituicao: null,
        jogadoresSelecionados: []
    };
}

// ========== FUNCIONALIDADE ADICIONAR ==========

async function mostrarAdicionar() {
    managementState.operacao = 'adicionar';
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-adicionar');
    const lista = document.getElementById('lista-adicionar');
    
    if (!gameState.reserves || gameState.reserves.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <span class="emoji">🪑</span>
                <h3>Nenhuma reserva</h3>
                <p>Todos os jogadores estão na fila</p>
            </div>
        `;
    } else {
        lista.innerHTML = await renderPlayersForSelection(gameState.reserves, 'adicionar');
        adicionarEventListenersJogadores();
    }
    
    modal.style.display = 'flex';
}

async function renderPlayersForSelection(players, operacao) {
    let html = '';
    
    // Pré-calcular todas as estatísticas primeiro
    const playerIds = players.map(p => p.id || p.jogador_id);
    await preCalculateStatsForPlayers(playerIds);
    
    for (const jogador of players) {
        // Para remover da fila, sempre usar jogador_id, não o id do registro da fila
        const jogadorId = jogador.jogador_id || jogador.id;  // Priorizar jogador_id
        const stats = statsCache.get(jogadorId) || { jogos: 0, vitorias: 0, gols: 0 };
        const playerId = jogadorId;
        const playerName = jogador.nome || jogador.jogador?.nome;
        
        html += `
            <div class="player-item-modal" data-player-id="${playerId}" data-player-name="${playerName}" data-operacao="${operacao}">
                <div class="player-info-modal">
                    <span class="player-name-modal">${playerName}</span>
                    <span class="player-stats-modal">J:${stats.jogos} V:${stats.vitorias} G:${stats.gols}</span>
                </div>
                ${operacao === 'remover' ? `<span class="player-position-modal">${jogador.posicao_fila || gameState.queue.findIndex(p => (p.jogador_id || p.id) === playerId) + 1}</span>` : ''}
            </div>
        `;
    }
    
    return html;
}

// Função otimizada para pré-calcular estatísticas
async function preCalculateStatsForPlayers(playerIds) {
    const uncachedIds = playerIds.filter(id => !statsCache.has(id));
    
    if (uncachedIds.length === 0) return;
    
    // Calcular em paralelo para melhor performance
    const promises = uncachedIds.map(async (playerId) => {
        const stats = await calcularEstatisticasJogador(playerId);
        statsCache.set(playerId, stats);
        return stats;
    });
    
    await Promise.all(promises);
}

// Função para adicionar event listeners aos jogadores
function adicionarEventListenersJogadores() {
    const playerItems = document.querySelectorAll('.player-item-modal');
    
    playerItems.forEach(item => {
        item.addEventListener('click', function() {
            const playerId = this.dataset.playerId; // Não usar parseInt() - pode ser UUID
            const playerName = this.dataset.playerName;
            const operacao = this.dataset.operacao;
            
            selecionarJogador(playerId, playerName, operacao);
        });
    });
}

// ========== FUNCIONALIDADE REMOVER ==========

async function mostrarRemover() {
    managementState.operacao = 'remover';
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-remover');
    const lista = document.getElementById('lista-remover');
    
    if (!gameState.queue || gameState.queue.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <span class="emoji">⏳</span>
                <h3>Fila vazia</h3>
                <p>Não há jogadores na fila para remover</p>
            </div>
        `;
    } else {
        lista.innerHTML = await renderPlayersForSelection(gameState.queue, 'remover');
        adicionarEventListenersJogadores();
    }
    
    modal.style.display = 'flex';
}

// ========== FUNCIONALIDADE SUBSTITUIR ==========

async function mostrarSubstituir() {
    managementState.operacao = 'substituir';
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-substituir');
    const listaSair = document.getElementById('lista-sair-fila');
    const step2 = document.getElementById('substituicao-step2');
    
    // Resetar step 2
    step2.style.display = 'none';
    managementState.jogadorSaindo = null;
    managementState.posicaoSubstituicao = null;
    
    if (!gameState.queue || gameState.queue.length === 0) {
        listaSair.innerHTML = `
            <div class="empty-state">
                <span class="emoji">⏳</span>
                <h3>Fila vazia</h3>
                <p>Não há jogadores na fila para substituir</p>
            </div>
        `;
    } else {
        listaSair.innerHTML = await renderPlayersForSelection(gameState.queue, 'substituir-sair');
        adicionarEventListenersJogadores();
    }
    
    modal.style.display = 'flex';
}

// ========== SELEÇÃO DE JOGADORES ==========

function selecionarJogador(jogadorId, nomeJogador, operacao) {
    switch (operacao) {
        case 'adicionar':
            confirmarAdicionar(jogadorId, nomeJogador);
            break;
        case 'remover':
            confirmarRemover(jogadorId, nomeJogador);
            break;
        case 'substituir-sair':
            selecionarJogadorSaindo(jogadorId, nomeJogador);
            break;
        case 'substituir-entrar':
            confirmarSubstituir(jogadorId, nomeJogador);
            break;
    }
}

function selecionarJogadorSaindo(jogadorId, nomeJogador) {
    // Encontrar posição do jogador na fila
    const posicao = gameState.queue.findIndex(p => (p.jogador_id || p.id) === jogadorId) + 1;
    
    managementState.jogadorSaindo = { id: jogadorId, nome: nomeJogador };
    managementState.posicaoSubstituicao = posicao;
    
    // Mostrar step 2
    const step2 = document.getElementById('substituicao-step2');
    const posicaoSpan = document.getElementById('posicao-substituicao');
    const jogadorSpan = document.getElementById('jogador-saindo');
    const listaEntrar = document.getElementById('lista-entrar-fila');
    
    posicaoSpan.textContent = posicao;
    jogadorSpan.textContent = nomeJogador;
    
    // Renderizar reservas para entrar
    if (gameState.reserves.length === 0) {
        listaEntrar.innerHTML = `
            <div class="empty-state">
                <span class="emoji">🪑</span>
                <h3>Nenhuma reserva</h3>
                <p>Não há jogadores na reserva</p>
            </div>
        `;
    } else {
        renderPlayersForSelection(gameState.reserves, 'substituir-entrar').then(html => {
            listaEntrar.innerHTML = html;
            adicionarEventListenersJogadores();
        });
    }
    
    step2.style.display = 'block';
}

// ========== CONFIRMAÇÕES ==========

function confirmarAdicionar(jogadorId, nomeJogador) {
    mostrarConfirmacao(
        'Adicionar Jogador',
        `<h4>➕ Adicionar à Fila</h4>
         <p><strong>${nomeJogador}</strong> será adicionado ao final da fila.</p>
         <p>Nova posição: <strong>${gameState.queue.length + 1}</strong></p>`,
        () => executarAdicionar(jogadorId)
    );
}

function confirmarRemover(jogadorId, nomeJogador) {
    const posicao = gameState.queue.findIndex(p => (p.jogador_id || p.id) === jogadorId) + 1;
    mostrarConfirmacao(
        'Remover Jogador',
        `<h4>➖ Remover da Fila</h4>
         <p><strong>${nomeJogador}</strong> será removido da posição <strong>${posicao}</strong>.</p>
         <p>Os jogadores seguintes subirão uma posição.</p>`,
        () => executarRemover(jogadorId)
    );
}

function confirmarSubstituir(jogadorEntraId, nomeJogadorEntra) {
    if (!managementState.jogadorSaindo) {
        console.error('Erro: managementState.jogadorSaindo é null');
        showError('Erro na substituição: jogador de saída não foi selecionado');
        return;
    }
    
    mostrarConfirmacao(
        'Substituir Jogadores',
        `<h4>🔄 Substituição</h4>
         <p><strong>Sai:</strong> ${managementState.jogadorSaindo.nome}</p>
         <p><strong>Entra:</strong> ${nomeJogadorEntra}</p>
         <p><strong>Posição:</strong> ${managementState.posicaoSubstituicao}</p>`,
        () => executarSubstituir(managementState.jogadorSaindo.id, jogadorEntraId)
    );
}

function mostrarConfirmacao(titulo, detalhes, callback) {
    const modal = document.getElementById('modal-confirmacao');
    const tituloEl = document.getElementById('titulo-confirmacao');
    const detalhesEl = document.getElementById('detalhes-confirmacao');
    const btnConfirmar = document.getElementById('btn-confirmar-operacao');
    
    tituloEl.textContent = titulo;
    detalhesEl.innerHTML = detalhes;
    
    // Remover listeners anteriores
    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
    const newBtn = document.getElementById('btn-confirmar-operacao');
    newBtn.onclick = () => {
        callback();
        fecharModal('modal-confirmacao');
    };
    
    // Fechar outros modais
    fecharModal('modal-adicionar');
    fecharModal('modal-remover');
    fecharModal('modal-substituir');
    
    modal.style.display = 'flex';
}

// ========== EXECUÇÃO DAS OPERAÇÕES ==========

async function executarAdicionar(jogadorId) {
    try {
        // Verificar limite máximo de jogadores na fila (padrão: 30)
        const LIMITE_FILA = 30;
        
        if (gameState.queue.length >= LIMITE_FILA) {
            showError(`Limite máximo de ${LIMITE_FILA} jogadores na fila foi atingido!`);
            return;
        }
        
        // Adicionar jogador ao final da fila
        const proximaPosicao = gameState.queue.length + 1;
        
        await adicionarJogadorFila(gameState.sessaoAtiva.id, jogadorId, proximaPosicao);
        
        // Atualizar estado local
        await loadGameState();
        await renderGameInterface();
        
        showSuccess('Jogador adicionado à fila com sucesso!');
        
    } catch (error) {
        console.error('Erro ao adicionar jogador:', error);
        showError('Erro ao adicionar jogador à fila');
    }
}

async function executarRemover(jogadorId) {
    try {
        // Remover jogador da fila
        await removerJogadorFila(gameState.sessaoAtiva.id, jogadorId);
        
        // Reorganizar posições dos jogadores restantes
        await reorganizarFilaAposRemocao(jogadorId);
        
        // Atualizar estado local
        await loadGameState();
        await renderGameInterface();
        
        showSuccess('Jogador removido da fila com sucesso!');
        
    } catch (error) {
        console.error('Erro ao remover jogador:', error);
        showError('Erro ao remover jogador da fila');
    }
}

async function executarSubstituir(jogadorSaiId, jogadorEntraId) {
    try {
        const posicao = managementState.posicaoSubstituicao;
        
        // Remover jogador da posição
        await removerJogadorFila(gameState.sessaoAtiva.id, jogadorSaiId);
        
        // Adicionar novo jogador na mesma posição
        await adicionarJogadorFila(gameState.sessaoAtiva.id, jogadorEntraId, posicao);
        
        // Atualizar estado local
        await loadGameState();
        await renderGameInterface();
        
        showSuccess('Substituição realizada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao substituir jogador:', error);
        showError('Erro ao realizar substituição');
    }
}

async function reorganizarFilaAposRemocao(jogadorRemovidoId) {
    try {
        // Buscar fila atual
        const fila = await obterFila(gameState.sessaoAtiva.id);
        
        // Reordenar posições
        for (let i = 0; i < fila.length; i++) {
            if (fila[i].posicao_fila !== i + 1) {
                await atualizarPosicaoFila(gameState.sessaoAtiva.id, fila[i].jogador_id, i + 1);
            }
        }
        
    } catch (error) {
        console.error('Erro ao reorganizar fila:', error);
        throw error;
    }
}

// Função auxiliar para atualizar posição na fila
async function atualizarPosicaoFila(sessaoId, jogadorId, novaPosicao) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        // Verificar se o jogador existe e pegar seu UUID real
        const { data: jogadorData, error: jogadorError } = await client
            .from('jogadores')
            .select('id')
            .eq('id', jogadorId)
            .single();
        
        if (jogadorError) {
            throw new Error(`Jogador não encontrado: ${jogadorError.message}`);
        }
        
        const { error } = await client
            .from('fila')
            .update({ posicao_fila: novaPosicao })
            .eq('sessao_id', sessaoId)
            .eq('jogador_id', jogadorData.id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao atualizar posição na fila:', error);
        throw error;
    }
}

// ========== FUNÇÃO PARA ENCERRAR PELADA ==========

function encerrarPelada() {
    mostrarConfirmacao(
        'Encerrar Pelada',
        `<h4>🏁 Encerrar Pelada</h4>
         <p>Tem certeza que deseja encerrar a pelada?</p>
         <p>Esta ação não pode ser desfeita.</p>`,
        () => {
            // Redirecionar para a página inicial
            window.location.href = 'index.html';
        }
    );
}

// Fechar modais ao clicar fora
document.addEventListener('click', function(event) {
    const modals = ['modal-adicionar', 'modal-remover', 'modal-substituir', 'modal-confirmacao'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            fecharModal(modalId);
        }
    });
});

// Event listener para o botão Iniciar Próxima Partida
document.addEventListener('DOMContentLoaded', function() {
    const startMatchBtn = document.getElementById('start-match-btn');
    if (startMatchBtn) {
        startMatchBtn.addEventListener('click', function() {
            iniciarProximaPartida();
        });
    }
});

// Função para iniciar próxima partida
async function iniciarProximaPartida() {
    try {
        console.log('🚀 Iniciando processo de nova partida...');
        
        // Verificar se há uma sessão ativa
        const sessao = await obterSessaoAtiva();
        console.log('📅 Sessão encontrada:', sessao);
        
        if (!sessao) {
            alert('❌ Não há sessão ativa. Inicie uma nova sessão primeiro.');
            // Redirecionar para página inicial para criar sessão
            window.location.href = 'index.html';
            return;
        }

        // Verificar se já há uma partida em andamento
        console.log('🔍 Verificando jogo ativo...');
        const jogoAtivo = await obterJogoAtivo();
        console.log('🎮 Jogo ativo:', jogoAtivo);
        
        if (jogoAtivo) {
            if (confirm('🎮 Já existe uma partida em andamento. Deseja continuar ela?')) {
                window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
            }
            return;
        }

        // Obter times atuais da fila
        console.log('👥 Obtendo próximos times...');
        const { time1, time2 } = await obterProximosTimes();
        console.log('👥 Times obtidos:', { time1, time2 });
        
        if (!time1 || !time2) {
            alert('❌ Erro ao obter times da fila. Verifique se há jogadores suficientes.');
            return;
        }
        
        if (time1.length < 6 || time2.length < 6) {
            alert(`❌ Não há jogadores suficientes para formar os times (necessário 12 jogadores). Encontrados: ${time1.length + time2.length} jogadores.`);
            return;
        }

        // Confirmação
        if (confirm('🎯 Deseja iniciar a próxima partida com os times atuais?')) {
            console.log('✅ Usuário confirmou. Criando novo jogo...');
            
            // Criar novo jogo no banco
            const novoJogo = await criarNovoJogo(sessao.id, time1, time2);
            console.log('🎯 Novo jogo criado:', novoJogo);
            
            if (novoJogo) {
                console.log('🔄 Redirecionando para partida...');
                // Redirecionar para tela de partida
                window.location.href = `partida.html?jogo_id=${novoJogo.id}`;
            } else {
                alert('❌ Erro ao criar nova partida. Tente novamente.');
            }
        }
    } catch (error) {
        console.error('Erro ao iniciar partida:', error);
        alert('❌ Erro ao iniciar partida. Tente novamente.');
    }
}

// ========== ESTATÍSTICAS DO DIA ==========

// Função para carregar estatísticas do dia
async function carregarEstatisticasDia() {
    try {
        console.log('🔍 Carregando estatísticas do dia... [VERSÃO SIMPLIFICADA]');
        
        const dataHoje = new Date().toISOString().split('T')[0];
        console.log('📅 Data de hoje:', dataHoje);
        
        // Contar partidas do dia diretamente na tabela jogos
        const { data: jogosHoje, error: erroJogos } = await client
            .from('jogos')
            .select('id')
            .gte('created_at', dataHoje + ' 00:00:00')
            .lt('created_at', dataHoje + ' 23:59:59');
            
        if (erroJogos) throw erroJogos;
        
        const totalPartidas = jogosHoje ? jogosHoje.length : 0;
        console.log('🏆 Partidas do dia:', totalPartidas);
        
        // Contar gols do dia diretamente na tabela gols
        const { data: golsHoje, error: erroGols } = await client
            .from('gols')
            .select('id')
            .gte('created_at', dataHoje + ' 00:00:00')
            .lt('created_at', dataHoje + ' 23:59:59');
            
        if (erroGols) throw erroGols;
        
        const totalGols = golsHoje ? golsHoje.length : 0;
        console.log('⚽ Gols do dia:', totalGols);

        // Atualizar interface
        document.getElementById('total-partidas').textContent = totalPartidas;
        document.getElementById('total-gols').textContent = totalGols;
        
        console.log(`📊 Estatísticas do dia: ${totalPartidas} partidas, ${totalGols} gols`);
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas do dia:', error);
        document.getElementById('total-partidas').textContent = '0';
        document.getElementById('total-gols').textContent = '0';
    }
}

// Função para mostrar tela sem sessão ativa
function showNoSessionScreen() {
    const noSessionScreen = document.getElementById('no-session-screen');
    const mainContent = document.querySelector('.main');
    
    if (noSessionScreen) {
        noSessionScreen.style.display = 'flex';
    }
    
    if (mainContent) {
        mainContent.style.display = 'none';
    }
}

// Função para esconder tela sem sessão ativa
function hideNoSessionScreen() {
    const noSessionScreen = document.getElementById('no-session-screen');
    const mainContent = document.querySelector('.main');
    
    if (noSessionScreen) {
        noSessionScreen.style.display = 'none';
    }
    
    if (mainContent) {
        mainContent.style.display = 'block';
    }
}

// Função para encerrar a pelada do dia
async function encerrarPelada() {
    try {
        if (!gameState.sessaoAtiva) {
            showError('Não há sessão ativa para encerrar');
            return;
        }

        // TELA DE SENHA PARA ENCERRAR PELADA
        const senhaCorreta = await solicitarSenhaEncerrarPelada();
        
        if (!senhaCorreta) {
            return; // Usuário cancelou ou senha incorreta
        }

        // Buscar informações da sessão atual
        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        const fila = await obterFila(gameState.sessaoAtiva.id);
        const totalJogadores = fila.length;
        const partidasFinalizadas = jogos.filter(j => j.status === 'finalizado').length;

        // Buscar gols do dia para estatísticas
        const dataHoje = new Date().toISOString().split('T')[0];
        const { data: golsHoje } = await client
            .from('gols')
            .select('id')
            .gte('created_at', dataHoje + ' 00:00:00')
            .lt('created_at', dataHoje + ' 23:59:59');
        
        const totalGols = golsHoje ? golsHoje.length : 0;

        // Finalizar a sessão
        console.log('🏁 Encerrando pelada do dia...');
        const resultado = await Database.finalizarSessao(gameState.sessaoAtiva.id);

        if (resultado.success) {
            // Mostrar mensagem de sucesso
            showSuccess(`🎉 Pelada encerrada com sucesso!<br>
                        ⚽ ${partidasFinalizadas} partidas • 🥅 ${totalGols} gols • 👥 ${totalJogadores} jogadores`);
            
            // Resetar estado e redirecionar após um tempo
            gameState.sessaoAtiva = null;
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        } else {
            showError('Erro ao encerrar a pelada: ' + resultado.error);
        }

    } catch (error) {
        console.error('Erro ao encerrar pelada:', error);
        showError('Erro ao encerrar a pelada');
    }
}

// Função para solicitar senha antes de encerrar pelada
async function solicitarSenhaEncerrarPelada() {
    return new Promise((resolve) => {
        // Criar modal de senha
        const modal = document.createElement('div');
        modal.className = 'modal-senha';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔐 Confirmação de Segurança</h3>
                    <p>Digite sua senha de usuário para encerrar a pelada</p>
                </div>
                
                <div class="modal-body">
                    <div class="warning-box">
                        <span class="emoji">🏁</span>
                        <div>
                            <strong>ATENÇÃO:</strong>
                            <p>Isto irá finalizar definitivamente a pelada do dia.<br>
                            Todos vão para casa! 🏠</p>
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <label for="senha-encerrar">Sua senha de usuário:</label>
                        <input type="password" id="senha-encerrar" placeholder="Digite sua senha" maxlength="20">
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button id="btn-cancelar-encerrar" class="btn-secondary">
                        <span class="emoji">❌</span>
                        <span>Cancelar</span>
                    </button>
                    <button id="btn-confirmar-encerrar" class="btn-danger">
                        <span class="emoji">🏁</span>
                        <span>Encerrar Pelada</span>
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar modal ao DOM
        document.body.appendChild(modal);
        
        // Focar no input de senha
        const inputSenha = document.getElementById('senha-encerrar');
        const btnConfirmar = document.getElementById('btn-confirmar-encerrar');
        const btnCancelar = document.getElementById('btn-cancelar-encerrar');
        
        setTimeout(() => inputSenha.focus(), 100);
        
        // Função para verificar senha
        const verificarSenha = async () => {
            const senhaDigitada = inputSenha.value.trim();
            
            // Obter senha do usuário logado
            const username = localStorage.getItem('userName');
            if (!username) {
                alert('Erro: Usuário não logado');
                document.body.removeChild(modal);
                resolve(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('usuarios')
                    .select('senha')
                    .eq('username', username)
                    .single();

                if (error) {
                    console.error('Erro ao buscar senha:', error);
                    alert('Erro ao verificar credenciais');
                    document.body.removeChild(modal);
                    resolve(false);
                    return;
                }

                const senhaCorreta = data?.senha;
                
                if (senhaDigitada === senhaCorreta) {
                    document.body.removeChild(modal);
                    resolve(true);
                } else {
                    // Senha incorreta - mostrar erro
                    inputSenha.style.borderColor = '#ff4444';
                    inputSenha.style.backgroundColor = '#fff5f5';
                    inputSenha.value = '';
                    inputSenha.placeholder = '❌ Senha incorreta - Digite sua senha de usuário';
                    inputSenha.focus();
                    
                    // Resetar estilo após 3 segundos
                    setTimeout(() => {
                        inputSenha.style.borderColor = '';
                        inputSenha.style.backgroundColor = '';
                        inputSenha.placeholder = 'Digite sua senha';
                    }, 3000);
                }
            } catch (error) {
                console.error('Erro ao conectar com banco:', error);
                alert('Erro de conexão');
                document.body.removeChild(modal);
                resolve(false);
            }
        };
        
        // Event listeners
        btnConfirmar.addEventListener('click', verificarSenha);
        
        btnCancelar.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        // Enter para confirmar
        inputSenha.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verificarSenha();
            }
        });
        
        // ESC para cancelar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}

// Função para aplicar restrições visuais para jogadores
function aplicarRestricoesVisuais() {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'player') {
        console.log('👁️ Aplicando modo visualização para jogador');
        
        // Aguardar um pouco para garantir que os elementos foram carregados
        setTimeout(() => {
            // Ocultar botões de ação para jogadores
            const botoesRestringir = [
                '#go-to-sorteio-btn',
                '#refresh-queue-btn',
                '.btn-add-queue',
                '.btn-remove',
                '.btn-encerrar-pelada',
                '.admin-controls',
                '.action-buttons',
                'button[onclick*="addPlayer"]',
                'button[onclick*="removePlayer"]',
                'button[onclick*="encerrar"]'
            ];
            
            botoesRestringir.forEach(selector => {
                const elementos = document.querySelectorAll(selector);
                elementos.forEach(el => {
                    el.style.display = 'none';
                });
            });
            
            // Adicionar aviso de modo visualização
            const container = document.querySelector('.container');
            if (container) {
                const avisoDiv = document.createElement('div');
                avisoDiv.innerHTML = `
                    <div style="background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 15px rgba(23, 162, 184, 0.3);">
                        <h4 style="margin: 0 0 8px 0; font-size: 1.1rem;">👁️ Modo Visualização</h4>
                        <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Você está visualizando a fila como jogador. Algumas funcionalidades estão ocultas.</p>
                    </div>
                `;
                container.insertBefore(avisoDiv, container.firstChild);
            }
            
            // Remover event listeners de botões (prevenir ações por teclado/programação)
            document.querySelectorAll('button').forEach(btn => {
                if (btn.onclick || btn.getAttribute('onclick')) {
                    const acoes = ['add', 'remove', 'encerrar', 'clear'];
                    const temAcao = acoes.some(acao => 
                        (btn.onclick && btn.onclick.toString().includes(acao)) ||
                        (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(acao))
                    );
                    
                    if (temAcao) {
                        btn.onclick = null;
                        btn.removeAttribute('onclick');
                        btn.style.cursor = 'not-allowed';
                        btn.title = 'Ação restrita para jogadores';
                    }
                }
            });
            
        }, 1000);
    }
}