// Variáveis globais do cronômetro
let intervaloCronometro = null;

// Estado de seleção de gol
let modoSelecaoGol = {
    ativo: false,
    time: null
};

// Configurar bloqueio de navegação quando cronômetro pausado
function configurarBloqueioNavegacao() {
    // Prevenir saída da página quando cronômetro pausado
    window.addEventListener('beforeunload', (e) => {
        if (estadoPartida.pausado && estadoPartida.iniciado) {
            e.preventDefault();
            e.returnValue = 'O cronômetro está pausado! Retome ou finalize a partida antes de sair.';
            return e.returnValue;
        }
    });
    
    // Interceptar cliques em links de navegação
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (link && estadoPartida.pausado && estadoPartida.iniciado) {
            e.preventDefault();
            
            // Mostrar alerta personalizado
            const confirmar = confirm(
                '⚠️ CRONÔMETRO PAUSADO!\n\n' +
                'Você tem um cronômetro pausado nesta partida.\n' +
                'Para navegar, você precisa:\n\n' +
                '• Retomar o cronômetro, OU\n' +
                '• Finalizar a partida\n\n' +
                'Deseja retomar o cronômetro agora?'
            );
            
            if (confirmar) {
                // Retomar cronômetro automaticamente
                toggleCronometro();
            }
            
            return false;
        }
    });
}

// Estado global da partida
let estadoPartida = {
    jogoId: null,
    timerId: null,
    iniciado: false,
    pausado: false,
    duracaoTotal: 10, // minutos (vem das regras)
    tempoRestante: 600, // segundos (10 minutos = 600 segundos)
    dataInicio: null,
    placarA: 0,
    placarB: 0,
    timeA: [],
    timeB: [],
    golsPartida: {},
    historicoAcoes: [],
    vitoriasConsecutivas: 0,
    limiteVitorias: 3,
    regras: null,
    acabouDeRetomar: false, // Flag para evitar salvamentos logo após retomar
    // Sistema de cores (padrão: A=preto, B=vermelho)
    coresColetes: {
        timeA: 'black',
        timeB: 'red'
    }
};

// Função para obter nome da cor do colete
function obterNomeCor(corCodigo) {
    const coresNomes = {
        'black': 'PRETO',
        'red': 'VERMELHO',
        'blue': 'AZUL',
        'green': 'VERDE',
        'yellow': 'AMARELO',
        'orange': 'LARANJA',
        'purple': 'ROXO',
        'white': 'BRANCO',
        'gray': 'CINZA',
        'navy': 'MARINHO'
    };
    return coresNomes[corCodigo] || corCodigo.toUpperCase();
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        mostrarLoading(true);
        
        // Aplicar restrições visuais para jogadores
        aplicarRestricoesVisuaisPartida();
        
        // Configurar bloqueio de navegação quando cronômetro pausado
        configurarBloqueioNavegacao();
        
        // Obter ID do jogo da URL
        const urlParams = new URLSearchParams(window.location.search);
        estadoPartida.jogoId = urlParams.get('jogo_id');
        
        if (!estadoPartida.jogoId) {
            // Verificar se existe algum jogo ativo na sessão
            const jogoAtivo = await obterJogoAtivo();
            if (jogoAtivo) {
                // Redirecionar para o jogo ativo encontrado
                window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
                return;
            } else {
                // Mostrar tela de nenhum jogo ativo
                mostrarTelaSemanJogo();
                return;
            }
        }
        
        // Carregar dados da partida
        await carregarPartida();
        
        // Configurar event listeners
        configurarEventListeners();
        
        // Iniciar sincronização
        iniciarSincronizacao();
        
        // Esconder tela sem jogo (caso esteja visível)
        esconderTelaSemanJogo();
        
        mostrarLoading(false);
        
    } catch (error) {
        console.error('Erro ao inicializar partida:', error);
        
        // Se não há jogo_id na URL, verificar se existe jogo ativo
        if (!estadoPartida.jogoId) {
            try {
                const jogoAtivo = await obterJogoAtivo();
                if (jogoAtivo) {
                    window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
                    return;
                } else {
                    mostrarTelaSemanJogo();
                    return;
                }
            } catch (err) {
                console.error('Erro ao verificar jogo ativo:', err);
                mostrarTelaSemanJogo();
                return;
            }
        }
        
        // Para outros erros, mostrar tela sem jogo
        mostrarTelaSemanJogo();
    }
});

// Carregar dados da partida do banco
async function carregarPartida() {
    try {
        console.log('🔍 Carregando partida com ID:', estadoPartida.jogoId);
        
        // Testar conectividade primeiro
        console.log('🔗 Testando conectividade...');
        const conectividade = await testarConectividade();
        if (!conectividade.success) {
            console.error('❌ Falha na conectividade:', conectividade.error);
            alert('❌ Erro de conexão com o banco de dados!\nVerifique sua internet e recarregue a página.');
            return;
        }
        console.log('✅ Conectividade confirmada');
        
        // Buscar jogo
        const jogo = await obterJogo(estadoPartida.jogoId);
        console.log('🎮 Jogo encontrado:', jogo);
        
        if (!jogo) {
            throw new Error('Jogo não encontrado');
        }
        
        // Verificar se jogo está finalizado
        if (jogo.status === 'finalizado') {
            alert('🏁 Esta partida já foi finalizada.');
            window.location.href = 'fila.html';
            return;
        }
        
        // Buscar regras (usar padrões se não existir)
        estadoPartida.regras = await obterRegras();
        if (!estadoPartida.regras) {
            console.log('⚠️ Nenhuma regra encontrada, usando padrões');
            estadoPartida.regras = {
                duracao: 10, // 10 minutos
                vitorias_consecutivas: 3
            };
        }
        estadoPartida.duracaoTotal = estadoPartida.regras.duracao;
        estadoPartida.limiteVitorias = estadoPartida.regras.vitorias_consecutivas;
        
        // Configurar tempo restante (regressivo)
        const duracaoTotalSegundos = estadoPartida.duracaoTotal * 60;
        let tempoDecorrido = jogo.tempo_decorrido || 0;
        
        console.log('⏱️ Calculando tempo restante:', {
            status: jogo.status,
            duracaoTotal: duracaoTotalSegundos,
            tempoDecorridoSalvo: jogo.tempo_decorrido,
            dataInicio: jogo.data_inicio
        });
        
        // Se o jogo está em andamento, calcular tempo real decorrido
        if (jogo.status === 'em_andamento' && jogo.data_inicio) {
            const agora = new Date();
            const dataInicio = new Date(jogo.data_inicio);
            tempoDecorrido = Math.floor((agora - dataInicio) / 1000);
            console.log('🔄 Jogo em andamento - tempo calculado:', tempoDecorrido);
        } else if (jogo.status === 'pausado') {
            console.log('⏸️ Jogo pausado - usando tempo salvo:', tempoDecorrido);
        }
        
        estadoPartida.tempoRestante = Math.max(0, duracaoTotalSegundos - tempoDecorrido);
        
        console.log('⏰ Tempo restante final:', estadoPartida.tempoRestante, 'segundos');
        
        // Buscar vitórias consecutivas atuais
        const sessao = await obterSessaoAtiva();
        estadoPartida.vitoriasConsecutivas = sessao?.vitorias_consecutivas_time || 0;
        
        // Restaurar estado do jogo
        console.log('📊 Dados do jogo carregados:', {
            id: jogo.id,
            placar_a: jogo.placar_a,
            placar_b: jogo.placar_b,
            tempo_decorrido: jogo.tempo_decorrido,
            status: jogo.status,
            data_inicio: jogo.data_inicio,
            tempoRestante_calculado: estadoPartida.tempoRestante,
            acoes_partida: jogo.acoes_partida?.length || 0,
            time_a_length: jogo.time_a?.length || 0,
            time_b_length: jogo.time_b?.length || 0
        });
        
        console.log('🎯 Estado após carregamento:', {
            estadoPartida_placarA: estadoPartida.placarA,
            estadoPartida_placarB: estadoPartida.placarB,
            estadoPartida_golsPartida: Object.keys(estadoPartida.golsPartida).length
        });
        
        estadoPartida.placarA = jogo.placar_a || 0;
        estadoPartida.placarB = jogo.placar_b || 0;
        estadoPartida.timeA = jogo.time_a;
        estadoPartida.timeB = jogo.time_b;
        estadoPartida.tempoDecorrido = jogo.tempo_decorrido || 0;
        estadoPartida.dataInicio = jogo.data_inicio ? new Date(jogo.data_inicio) : null;
        estadoPartida.historicoAcoes = []; // Não usado mais, manter compatibilidade
        estadoPartida.iniciado = jogo.status === 'em_andamento' && estadoPartida.dataInicio;
        estadoPartida.pausado = jogo.status === 'pausado';
        
        // Log específico para jogo pausado
        if (estadoPartida.pausado) {
            console.log('⏸️ CARREGAMENTO: Jogo pausado detectado:', {
                tempo_decorrido_banco: jogo.tempo_decorrido,
                tempoRestante_calculado: estadoPartida.tempoRestante,
                estadoPartida_tempoDecorrido: estadoPartida.tempoDecorrido,
                dataInicio: estadoPartida.dataInicio,
                status_banco: jogo.status,
                duracaoTotal: estadoPartida.duracaoTotal
            });
            
            // VERIFICAÇÃO CRÍTICA: Se não temos tempo decorrido, há um problema
            if (!estadoPartida.tempoDecorrido || estadoPartida.tempoDecorrido === 0) {
                console.error('🚨 PROBLEMA CRÍTICO: Tempo decorrido é zero no carregamento!');
                console.log('🔍 Dados completos do jogo:', jogo);
            }
        }
        
        // Buscar gols da partida
        const resultadoGols = await Database.buscarGolsPorJogo(estadoPartida.jogoId);
        estadoPartida.golsPartida = {};
        
        if (resultadoGols.success && resultadoGols.data) {
            resultadoGols.data.forEach(gol => {
                estadoPartida.golsPartida[gol.jogador_id] = (estadoPartida.golsPartida[gol.jogador_id] || 0) + 1;
            });
            console.log('⚽ Gols carregados:', estadoPartida.golsPartida);
        }
        
        // Atualizar interface
        await renderizarPartida();
        
        // Atualizar display de vitórias consecutivas
        await atualizarDisplayVitoriasConsecutivas();
        
        // Aplicar cores padrão
        aplicarCoresVisuais();
        
        // Inicializar cronômetro se a partida estiver em andamento
        if (estadoPartida.iniciado && !estadoPartida.pausado) {
            console.log('🔄 Reiniciando cronômetro da partida em andamento...');
            // Reiniiciar o intervalo do cronômetro
            if (intervaloCronometro) {
                clearInterval(intervaloCronometro);
            }
            intervaloCronometro = setInterval(atualizarDisplayCronometro, 1000);
        }
        
        console.log('✅ Partida carregada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao carregar partida:', error);
        throw error;
    }
}

// Renderizar interface da partida
async function renderizarPartida() {
    console.log('🖼️ Renderizando partida com placar:', {
        placarA: estadoPartida.placarA,
        placarB: estadoPartida.placarB,
        golsPartida: estadoPartida.golsPartida
    });
    
    // Atualizar títulos dos times com as cores
    atualizarTitulosTimes();
    
    // Atualizar cronômetro
    atualizarDisplayCronometro();
    
    // Atualizar placar
    document.getElementById('score-a').textContent = estadoPartida.placarA;
    document.getElementById('score-b').textContent = estadoPartida.placarB;
    
    // Atualizar vitórias consecutivas - buscar valor real do banco
    await atualizarDisplayVitoriasConsecutivas();
    
    // Renderizar times
    await renderizarTime('A', estadoPartida.timeA, 'team-a-players');
    await renderizarTime('B', estadoPartida.timeB, 'team-b-players');
    
    // Atualizar botões
    atualizarBotoes();
}

// Função para atualizar display de vitórias consecutivas
async function atualizarDisplayVitoriasConsecutivas() {
    try {
        const consecutiveElement = document.getElementById('consecutive-wins');
        if (!consecutiveElement) return;
        
        // Buscar vitórias consecutivas reais do banco
        const vitorias = await obterVitoriasConsecutivasTimeA();
        const limite = estadoPartida.limiteVitorias || 3;
        
        consecutiveElement.textContent = `Vitórias consecutivas: ${vitorias}/${limite}`;
        
        // Adicionar indicador visual quando próximo do limite
        if (vitorias >= limite - 1) {
            consecutiveElement.style.color = '#ff6b35';
            consecutiveElement.style.fontWeight = 'bold';
        } else {
            consecutiveElement.style.color = 'rgba(255, 255, 255, 0.8)';
            consecutiveElement.style.fontWeight = 'normal';
        }
        
    } catch (error) {
        console.error('Erro ao atualizar display de vitórias consecutivas:', error);
        // Fallback para valor padrão
        const consecutiveElement = document.getElementById('consecutive-wins');
        if (consecutiveElement) {
            consecutiveElement.textContent = `Vitórias consecutivas: 0/${estadoPartida.limiteVitorias || 3}`;
        }
    }
}

// Renderizar jogadores de um time
async function renderizarTime(time, jogadores, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    // Buscar todos os jogadores de uma vez
    const todosJogadores = await obterJogadores();
    const mapaJogadores = {};
    todosJogadores.forEach(j => mapaJogadores[j.id] = j);
    
    for (const jogadorId of jogadores) {
        const jogador = mapaJogadores[jogadorId];
        if (!jogador) continue;
        
        const golsNaPartida = estadoPartida.golsPartida[jogadorId] || 0;
        
        // Criar emojis de bolinhas para gols
        const bolinhasGols = golsNaPartida > 0 ? ' ' + '⚽'.repeat(golsNaPartida) : '';
        
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <div class="player-name" data-jogador-id="${jogadorId}" data-time="${time}" data-nome="${jogador.nome}">${jogador.nome}${bolinhasGols}</div>
        `;
        
        // Adicionar event listener para seleção de gol
        const playerNameElement = playerDiv.querySelector('.player-name');
        playerNameElement.addEventListener('click', (e) => {
            if (modoSelecaoGol.ativo && modoSelecaoGol.time === time) {
                selecionarJogadorGol(jogadorId, time, jogador.nome);
            }
        });
        
        container.appendChild(playerDiv);
    }
    
    // Adicionar opção "Gol Contra" quando estiver no modo de seleção de gol
    if (modoSelecaoGol.ativo && modoSelecaoGol.time === time) {
        console.log(`🔄 Adicionando opção "Gol Contra" para time ${time}`);
        
        const golContraDiv = document.createElement('div');
        golContraDiv.className = 'player-item gol-contra-option';
        golContraDiv.innerHTML = `
            <div class="player-name gol-contra-name" data-gol-contra="true" data-time="${time}">🔄 Gol Contra</div>
        `;
        
        // Event listener para gol contra
        const golContraElement = golContraDiv.querySelector('.player-name');
        golContraElement.addEventListener('click', (e) => {
            console.log('🔄 Clique em Gol Contra detectado');
            if (modoSelecaoGol.ativo && modoSelecaoGol.time === time) {
                marcarGolContra(time); // Passa o time que vai ser beneficiado
                desativarModoSelecaoGol();
            }
        });
        
        container.appendChild(golContraDiv);
        console.log(`✅ Opção "Gol Contra" adicionada ao time ${time}`);
    }
}

// Configurar event listeners
function configurarEventListeners() {
    // Botão Play/Pause
    document.getElementById('play-pause-btn').addEventListener('click', toggleCronometro);
    
    // Botão Reset
    document.getElementById('reset-btn').addEventListener('click', resetCronometro);
    
    // Botões de troca de cor (qualquer um dos dois)
    document.getElementById('team-a-color').addEventListener('click', trocarCoresColetes);
    document.getElementById('team-b-color').addEventListener('click', trocarCoresColetes);
    
    // Botões de Gol
    document.getElementById('goal-team-a').addEventListener('click', (e) => {
        e.stopPropagation();
        ativarModoSelecaoGol('A');
    });
    document.getElementById('goal-team-b').addEventListener('click', (e) => {
        e.stopPropagation();
        ativarModoSelecaoGol('B');
    });
    
    // Botão VAR
    document.getElementById('var-btn').addEventListener('click', mostrarVAR);
    
    // Botão Finalizar
    document.getElementById('finish-btn').addEventListener('click', finalizarPartida);
    
    // Botão Cancelar Partida no rodapé
    document.getElementById('cancel-footer-btn').addEventListener('click', (e) => {
        e.preventDefault();
        mostrarModalCancelarPartida();
    });
    
    // Botões do modal cancelar partida
    document.getElementById('cancelar-confirmacao').addEventListener('click', fecharModalCancelarPartida);
    document.getElementById('confirmar-cancelamento').addEventListener('click', cancelarPartida);
    
    // Fechar modal cancelar clicando fora
    document.getElementById('modal-cancelar-partida').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cancelar-partida') {
            fecharModalCancelarPartida();
        }
    });
    
    // Modal confirmação
    document.getElementById('modal-cancelar').addEventListener('click', () => fecharModal());
    document.getElementById('modal-confirmar').addEventListener('click', confirmarAcao);
    
    // Cancelar modo de seleção de gol ao clicar fora
    document.addEventListener('click', (e) => {
        if (modoSelecaoGol.ativo) {
            // Se clicou em um jogador, o event listener do jogador vai tratar
            if (e.target.closest('.player-name') || 
                e.target.closest('.goal-btn') || 
                e.target.closest('.team-section') ||
                e.target.id.includes('goal-team')) {
                console.log('👆 Clique em área válida - não cancelar modo');
                return;
            }
            
            console.log('❌ Clique fora - cancelando modo seleção de gol');
            // Clicou fora - cancelar modo
            desativarModoSelecaoGol();
        }
    });
    
    // Fechar modals clicando fora
    document.getElementById('modal-confirmacao').addEventListener('click', (e) => {
        if (e.target.id === 'modal-confirmacao') {
            fecharModal();
        }
    });
    
    // Botões do modal fim de tempo
    document.getElementById('btn-finalizar-partida').addEventListener('click', () => {
        // Verificar se há empate e se um time foi selecionado
        if (estadoPartida.placarA === estadoPartida.placarB) {
            const timesSelecionados = document.querySelectorAll('.btn-time.selected');
            if (timesSelecionados.length === 0) {
                alert('⚠️ Selecione qual time terá prioridade na fila!');
                return;
            }
        }
        
        if (confirm('🏁 Confirma a finalização da partida?')) {
            fecharModalFimTempo();
            finalizarPartida();
        }
    });
    
    document.getElementById('btn-realizar-ajuste').addEventListener('click', () => {
        fecharModalFimTempo();
        // Cronômetro já está parado, usuário pode fazer ajustes
        alert('⚽ Cronômetro finalizado. Você pode marcar gols de último segundo se necessário.');
    });
    
    // Botões de seleção de prioridade
    document.getElementById('btn-prioridade-preto').addEventListener('click', function() {
        selecionarTimePrioridade('preto');
    });
    
    document.getElementById('btn-prioridade-vermelho').addEventListener('click', function() {
        selecionarTimePrioridade('vermelho');
    });
    
    // Event listeners para modal de empate
    document.getElementById('btn-empate-preto').addEventListener('click', function() {
        selecionarTimePrioridade('preto');
    });
    
    document.getElementById('btn-empate-vermelho').addEventListener('click', function() {
        selecionarTimePrioridade('vermelho');
    });
    
    document.getElementById('btn-confirmar-empate-final').addEventListener('click', function() {
        const timesSelecionados = document.querySelectorAll('#modal-confirmar-empate .btn-time.selected');
        if (timesSelecionados.length === 0) {
            alert('⚠️ Selecione qual time terá prioridade na fila!');
            return;
        }
        
        if (confirm('🏁 Confirma a finalização da partida em empate?')) {
            fecharModaisConfirmacao();
            processarFinalizacao();
        }
    });
    
    document.getElementById('btn-cancelar-empate').addEventListener('click', function() {
        fecharModaisConfirmacao();
    });
    
    // Event listeners para modal de vitória
    document.getElementById('btn-confirmar-vitoria-final').addEventListener('click', function() {
        if (confirm('🏁 Confirma a finalização da partida?')) {
            fecharModaisConfirmacao();
            processarFinalizacao();
        }
    });
    
    document.getElementById('btn-cancelar-vitoria').addEventListener('click', function() {
        fecharModaisConfirmacao();
    });
}

// Perguntar se deseja iniciar cronômetro
// Reset cronômetro
async function resetCronometro() {
    if (confirm('🔄 Tem certeza que deseja resetar o cronômetro?')) {
        // Parar intervalo do cronômetro
        if (intervaloCronometro) {
            clearInterval(intervaloCronometro);
            intervaloCronometro = null;
        }
        
        estadoPartida.iniciado = false;
        estadoPartida.pausado = false;
        estadoPartida.tempoRestante = estadoPartida.duracaoTotal * 60;
        estadoPartida.dataInicio = null;
        estadoPartida.tempoDecorrido = 0;
        
        // Atualizar display
        atualizarDisplayCronometro();
        atualizarStatusCronometro('Cronômetro resetado');
        atualizarBotaoCronometro();
        
        // Salvar no banco
        await atualizarJogoNoBanco(estadoPartida.jogoId, {
            tempo_decorrido: 0
        });
    }
}

// Toggle cronômetro (Play/Pause)
async function toggleCronometro() {
    try {
        if (!estadoPartida.iniciado) {
            // Iniciar cronômetro
            estadoPartida.dataInicio = new Date();
            estadoPartida.iniciado = true;
            estadoPartida.pausado = false;
            
            // Iniciar intervalo do cronômetro
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            intervaloCronometro = setInterval(atualizarDisplayCronometro, 1000);
            
            // Salvar no banco
            await atualizarJogoNoBanco(estadoPartida.jogoId, {
                data_inicio: estadoPartida.dataInicio,
                status: 'em_andamento'
            });
            
        } else if (estadoPartida.pausado) {
            // Retomar cronômetro
            console.log('🚀 DEBUG: Estado antes da retomada:', {
                pausado: estadoPartida.pausado,
                tempoDecorridoSalvo: estadoPartida.tempoDecorrido,
                tempoRestanteAtual: estadoPartida.tempoRestante,
                duracaoTotal: estadoPartida.duracaoTotal * 60,
                dataInicioAtual: estadoPartida.dataInicio
            });
            
            // VERIFICAR se realmente temos um tempo decorrido salvo
            if (!estadoPartida.tempoDecorrido || estadoPartida.tempoDecorrido === 0) {
                console.error('❌ PROBLEMA: Não há tempo decorrido salvo para retomar!');
                console.log('🔍 Vamos buscar do banco novamente...');
                
                // Buscar dados atuais do banco
                const jogoAtual = await obterJogo(estadoPartida.jogoId);
                console.log('📊 Dados do banco na retomada:', {
                    status: jogoAtual?.status,
                    tempo_decorrido: jogoAtual?.tempo_decorrido,
                    data_inicio: jogoAtual?.data_inicio
                });
                
                if (jogoAtual?.tempo_decorrido) {
                    estadoPartida.tempoDecorrido = jogoAtual.tempo_decorrido;
                    console.log('✅ Tempo decorrido recuperado do banco:', estadoPartida.tempoDecorrido);
                }
            }
            
            // CORREÇÃO: Usar o tempo decorrido SALVO ao invés de calcular pelo tempo restante
            const tempoDecorridoReal = estadoPartida.tempoDecorrido;
            
            console.log('🔧 RETOMADA: Calculando nova dataInicio:', {
                tempoDecorridoReal: tempoDecorridoReal,
                agora: new Date(),
                milissegundosParaSubtrair: tempoDecorridoReal * 1000,
                novaDataInicio: new Date(Date.now() - (tempoDecorridoReal * 1000))
            });
            
            estadoPartida.dataInicio = new Date(Date.now() - (tempoDecorridoReal * 1000));
            estadoPartida.pausado = false;
            
            // Reiniciar intervalo do cronômetro
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            
            // IMPORTANTE: Salvar primeiro no banco ANTES de iniciar o intervalo
            await atualizarJogoNoBanco(estadoPartida.jogoId, { 
                status: 'em_andamento',
                data_inicio: estadoPartida.dataInicio
                // NÃO incluir tempo_decorrido aqui para não sobrescrever
            });
            
            console.log('⏰ Dados salvos, iniciando intervalo do cronômetro');
            
            // Esconder aviso de navegação bloqueada
            esconderAvisoNavegacaoBloqueada();
            
            // Marcar que acabou de retomar para evitar salvamentos imediatos
            estadoPartida.acabouDeRetomar = true;
            
            intervaloCronometro = setInterval(atualizarDisplayCronometro, 1000);
            
            // Limpar flag após 5 segundos
            setTimeout(() => {
                estadoPartida.acabouDeRetomar = false;
                console.log('🔓 Flag de retomada limpa, salvamento periódico liberado');
            }, 5000);
            
        } else {
            // Pausar cronômetro
            estadoPartida.pausado = true;
            const tempoCalculado = calcularTempoDecorrido();
            estadoPartida.tempoDecorrido = tempoCalculado;
            
            // Mostrar aviso de navegação bloqueada
            mostrarAvisoNavegacaoBloqueada();
            
            // Calcular também o tempo restante para debugar
            const duracaoTotal = estadoPartida.duracaoTotal * 60;
            const tempoRestanteCalculado = duracaoTotal - tempoCalculado;
            
            // Atualizar também o tempo restante no estado
            estadoPartida.tempoRestante = tempoRestanteCalculado;
            
            console.log('⏸️ Pausando cronômetro:', {
                tempoDecorrido: tempoCalculado,
                tempoRestante: tempoRestanteCalculado,
                duracaoTotal: duracaoTotal,
                dataInicio: estadoPartida.dataInicio,
                agora: new Date()
            });
            
            // Parar intervalo do cronômetro
            if (intervaloCronometro) {
                clearInterval(intervaloCronometro);
                intervaloCronometro = null;
            }
            
            const dadosParaSalvar = { 
                status: 'pausado',
                tempo_decorrido: estadoPartida.tempoDecorrido
            };
            
            console.log('💾 Tentando salvar pause:', dadosParaSalvar);
            
            const resultadoPause = await atualizarJogoNoBanco(estadoPartida.jogoId, dadosParaSalvar);
            
            if (!resultadoPause?.success) {
                console.error('❌ Falha ao salvar pause:', resultadoPause?.error);
            } else {
                console.log('✅ Pause salvo com sucesso!', resultadoPause.data);
                
                // Verificar se foi salvo corretamente - buscar o jogo novamente
                const jogoVerificacao = await obterJogo(estadoPartida.jogoId);
                console.log('🔍 Verificação pós-salvamento:', {
                    tempo_decorrido_salvo: jogoVerificacao?.tempo_decorrido,
                    status_salvo: jogoVerificacao?.status
                });
            }
        }
        
        atualizarBotoes();
        
    } catch (error) {
        console.error('Erro ao toggle cronômetro:', error);
        alert('❌ Erro ao controlar cronômetro.');
    }
}

// Calcular tempo decorrido
function calcularTempoDecorrido() {
    if (!estadoPartida.iniciado || !estadoPartida.dataInicio) {
        console.log('⚠️ calcularTempoDecorrido: jogo não iniciado ou sem dataInicio');
        return 0;
    }
    
    const agora = new Date();
    const diferenca = Math.floor((agora - estadoPartida.dataInicio) / 1000);
    const resultado = Math.max(0, diferenca);
    
    console.log('🧮 calcularTempoDecorrido:', {
        agora: agora,
        dataInicio: estadoPartida.dataInicio,
        diferenca: diferenca,
        resultado: resultado
    });
    
    return resultado;
}

// Atualizar display do cronômetro (regressivo)
async function atualizarDisplayCronometro() {
    let tempoRestanteAtual;
    
    if (estadoPartida.iniciado && !estadoPartida.pausado && estadoPartida.dataInicio) {
        // Calcular tempo baseado no timestamp real
        const agora = new Date();
        const tempoDecorridoReal = Math.floor((agora - estadoPartida.dataInicio) / 1000);
        const duracaoTotalSegundos = estadoPartida.duracaoTotal * 60;
        tempoRestanteAtual = Math.max(0, duracaoTotalSegundos - tempoDecorridoReal);
        
        console.log('⏱️ Display cronômetro:', {
            tempoDecorridoReal: tempoDecorridoReal,
            tempoRestanteAtual: tempoRestanteAtual,
            dataInicio: estadoPartida.dataInicio,
            agora: agora
        });
        
        // Salvar no banco periodicamente (a cada 10 segundos)
        // MAS APENAS se não acabou de retomar (evita sobrescrever tempo correto)
        if (tempoDecorridoReal % 10 === 0 && tempoDecorridoReal > 3 && !estadoPartida.acabouDeRetomar) {
            console.log('💾 Salvando tempo periodicamente:', tempoDecorridoReal);
            try {
                const resultado = await atualizarJogoNoBanco(estadoPartida.jogoId, { tempo_decorrido: tempoDecorridoReal });
                if (!resultado.success && resultado.networkError) {
                    console.warn('⚠️ Erro de rede - cronômetro continua funcionando normalmente');
                }
            } catch (error) {
                console.warn('⚠️ Erro ao salvar tempo - continuando:', error.message);
            }
        } else if (estadoPartida.acabouDeRetomar && tempoDecorridoReal % 10 === 0) {
            console.log('🚫 Salvamento bloqueado - acabou de retomar:', tempoDecorridoReal);
        }
    } else {
        // Usar valor armazenado quando pausado ou não iniciado
        tempoRestanteAtual = estadoPartida.tempoRestante;
    }
    
    const minutos = Math.floor(tempoRestanteAtual / 60);
    const segundos = tempoRestanteAtual % 60;
    
    const display = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    
    document.getElementById('timer-display').textContent = display;
    
    // Verificar se tempo acabou
    if (tempoRestanteAtual <= 0) {
        document.getElementById('timer-display').style.color = '#dc3545';
        if (estadoPartida.iniciado) {
            // Parar cronômetro
            estadoPartida.iniciado = false;
            if (intervaloCronometro) {
                clearInterval(intervaloCronometro);
                intervaloCronometro = null;
            }
            
            mostrarModalFimTempo();
            // finalizarPartida() será chamado pelo botão do modal
        }
    } else if (tempoRestanteAtual <= 60) {
        // Último minuto - cor vermelha
        document.getElementById('timer-display').style.color = '#dc3545';
    } else {
        document.getElementById('timer-display').style.color = 'white';
    }
    
    // Atualizar estado para pausar/reset
    if (estadoPartida.iniciado && !estadoPartida.pausado && estadoPartida.dataInicio) {
        estadoPartida.tempoRestante = tempoRestanteAtual;
    }
}

// Atualizar status do cronômetro
function atualizarStatusCronometro(status) {
    const statusElement = document.getElementById('timer-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Atualizar botões conforme estado
function atualizarBotoes() {
    atualizarBotaoCronometro();
    atualizarBotaoCancelar();
}

// Mostrar modal personalizado de fim de tempo
function mostrarModalFimTempo() {
    // Obter nomes das cores dos coletes
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Atualizar elementos do modal
    document.getElementById('cor-time-a').textContent = nomeCorTimeA;
    document.getElementById('cor-time-b').textContent = nomeCorTimeB;
    document.getElementById('placar-final-a').textContent = estadoPartida.placarA;
    document.getElementById('placar-final-b').textContent = estadoPartida.placarB;
    
    // Atualizar botões de prioridade com cores corretas
    document.getElementById('nome-time-preto').textContent = estadoPartida.coresColetes.timeA === 'preto' ? nomeCorTimeA : nomeCorTimeB;
    document.getElementById('nome-time-vermelho').textContent = estadoPartida.coresColetes.timeA === 'vermelho' ? nomeCorTimeA : nomeCorTimeB;
    
    // Determinar resultado da partida
    let resultadoTexto = '';
    const selecaoPrioridade = document.getElementById('selecao-prioridade');
    
    if (estadoPartida.placarA > estadoPartida.placarB) {
        resultadoTexto = `🎉 ${nomeCorTimeA} VENCEU!`;
        selecaoPrioridade.style.display = 'none';
    } else if (estadoPartida.placarB > estadoPartida.placarA) {
        resultadoTexto = `🎉 ${nomeCorTimeB} VENCEU!`;
        selecaoPrioridade.style.display = 'none';
    } else {
        resultadoTexto = `🤝 EMPATE!<br>Par ou Ímpar, decide a prioridade de retorno`;
        selecaoPrioridade.style.display = 'block';
    }
    document.getElementById('resultado-texto').innerHTML = resultadoTexto;
    
    // Mostrar modal
    const modal = document.getElementById('modal-fim-tempo');
    modal.style.display = 'flex';
    
    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';
}

// Fechar modal de fim de tempo
function fecharModalFimTempo() {
    const modal = document.getElementById('modal-fim-tempo');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpar seleções
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Função para selecionar time com prioridade no empate
function selecionarTimePrioridade(corSelecionada) {
    // Remover seleção anterior de ambos os modais
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Adicionar seleção aos botões corretos em ambos os modais
    if (corSelecionada === 'preto') {
        const btnFimTempo = document.getElementById('btn-prioridade-preto');
        const btnEmpate = document.getElementById('btn-empate-preto');
        if (btnFimTempo) btnFimTempo.classList.add('selected');
        if (btnEmpate) btnEmpate.classList.add('selected');
    } else {
        const btnFimTempo = document.getElementById('btn-prioridade-vermelho');
        const btnEmpate = document.getElementById('btn-empate-vermelho');
        if (btnFimTempo) btnFimTempo.classList.add('selected');
        if (btnEmpate) btnEmpate.classList.add('selected');
    }
    
    // Converter cor para time A ou B baseado nas cores dos coletes
    let timePrioridade;
    if (corSelecionada === 'preto') {
        timePrioridade = estadoPartida.coresColetes.timeA === 'preto' ? 'A' : 'B';
    } else {
        timePrioridade = estadoPartida.coresColetes.timeA === 'vermelho' ? 'A' : 'B';
    }
    
    // Salvar a escolha para usar na finalização (usar a variável que o sistema espera)
    estadoPartida.timePrioridadeEmpate = timePrioridade;
    console.log(`🎯 Selecionado time ${timePrioridade} para prioridade (cor: ${corSelecionada})`);
}

// Modal para confirmar empate manual
function mostrarModalConfirmarEmpate() {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Atualizar elementos do modal
    document.getElementById('cor-time-empate-a').textContent = nomeCorTimeA;
    document.getElementById('cor-time-empate-b').textContent = nomeCorTimeB;
    document.getElementById('placar-empate-a').textContent = estadoPartida.placarA;
    document.getElementById('placar-empate-b').textContent = estadoPartida.placarB;
    
    // Atualizar botões com cores corretas
    document.getElementById('nome-empate-preto').textContent = estadoPartida.coresColetes.timeA === 'preto' ? nomeCorTimeA : nomeCorTimeB;
    document.getElementById('nome-empate-vermelho').textContent = estadoPartida.coresColetes.timeA === 'vermelho' ? nomeCorTimeA : nomeCorTimeB;
    
    // Limpar seleções anteriores
    document.querySelectorAll('#modal-confirmar-empate .btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Mostrar modal
    document.getElementById('modal-confirmar-empate').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Modal para confirmar vitória
async function mostrarModalConfirmarVitoria(timeVencedor, nomeTimeVencedor) {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Atualizar elementos do modal
    document.getElementById('cor-time-vitoria-a').textContent = nomeCorTimeA;
    document.getElementById('cor-time-vitoria-b').textContent = nomeCorTimeB;
    document.getElementById('placar-vitoria-a').textContent = estadoPartida.placarA;
    document.getElementById('placar-vitoria-b').textContent = estadoPartida.placarB;
    
    // Buscar vitórias consecutivas reais do banco de dados
    let vitoriasAtuais = 0;
    try {
        vitoriasAtuais = await obterVitoriasConsecutivasTimeA();
    } catch (error) {
        console.warn('Erro ao buscar vitórias consecutivas:', error);
        vitoriasAtuais = estadoPartida.vitoriasConsecutivas || 0;
    }
    
    // Calcular próxima vitória (atual + 1)
    const proximaVitoria = vitoriasAtuais + 1;
    
    // Atualizar texto da vitória com informação correta
    document.getElementById('texto-resultado-vitoria').innerHTML = `🎉 ${nomeTimeVencedor} VENCEU!<br>⚡ ${proximaVitoria}ª vitória consecutiva`;
    
    // Verificar se é terceira vitória consecutiva
    const avisoTerceiraVitoria = document.getElementById('aviso-terceira-vitoria');
    
    if (vitoriasAtuais >= 2) { // Será a terceira vitória
        avisoTerceiraVitoria.style.display = 'block';
        document.getElementById('time-terceira-vitoria').textContent = nomeTimeVencedor;
        document.getElementById('titulo-vitoria').textContent = 'Terceira Vitória!';
    } else {
        avisoTerceiraVitoria.style.display = 'none';
        document.getElementById('titulo-vitoria').textContent = 'Vitória!';
    }
    
    // Salvar informação do time vencedor
    estadoPartida.timeVencedorModal = timeVencedor;
    
    // Mostrar modal
    document.getElementById('modal-confirmar-vitoria').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Fechar modais de confirmação
function fecharModaisConfirmacao() {
    document.getElementById('modal-confirmar-empate').style.display = 'none';
    document.getElementById('modal-confirmar-vitoria').style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpar seleções
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Atualizar títulos dos times com base nas cores dos coletes
function atualizarTitulosTimes() {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    document.getElementById('titulo-time-a').textContent = nomeCorTimeA;
    document.getElementById('titulo-time-b').textContent = nomeCorTimeB;
}

// Atualizar visibilidade do botão cancelar
function atualizarBotaoCancelar() {
    const cancelFooterBtn = document.getElementById('cancel-footer-btn');
    if (!cancelFooterBtn) return;
    
    // Mostrar botão cancelar sempre que há uma partida ativa
    cancelFooterBtn.style.display = 'flex';
}

// Atualizar botão do cronômetro
function atualizarBotaoCronometro() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const emoji = playPauseBtn.querySelector('.emoji');
    
    if (!estadoPartida.iniciado) {
        emoji.textContent = '▶️';
        atualizarStatusCronometro('Pronto para iniciar');
    } else if (estadoPartida.pausado) {
        emoji.textContent = '▶️';
        atualizarStatusCronometro('Pausado');
    } else {
        emoji.textContent = '⏸️';
        atualizarStatusCronometro('Em andamento');
    }
}

// Marcar gol
// Sistema de Cores dos Coletes - Versão Simplificada
function trocarCoresColetes() {
    // Trocar as cores dos times
    const corTemporariaA = estadoPartida.coresColetes.timeA;
    estadoPartida.coresColetes.timeA = estadoPartida.coresColetes.timeB;
    estadoPartida.coresColetes.timeB = corTemporariaA;
    
    // Aplicar mudanças visuais
    aplicarCoresVisuais();
    
    // Feedback suave de troca
    const buttons = document.querySelectorAll('.team-color-btn');
    buttons.forEach(btn => {
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    });
}

function aplicarCoresVisuais() {
    // Atualizar círculos de cor
    const circleA = document.getElementById('color-circle-a');
    const circleB = document.getElementById('color-circle-b');
    
    // Limpar classes anteriores
    circleA.classList.remove('black', 'red');
    circleB.classList.remove('black', 'red');
    
    // Aplicar novas cores aos círculos
    circleA.classList.add(estadoPartida.coresColetes.timeA);
    circleB.classList.add(estadoPartida.coresColetes.timeB);
    
    // Aplicar cores aos quadros dos times
    const teamSectionA = document.querySelector('.team-section:first-child');
    const teamSectionB = document.querySelector('.team-section:last-child');
    
    // Limpar classes anteriores
    teamSectionA.classList.remove('black', 'red');
    teamSectionB.classList.remove('black', 'red');
    
    // Aplicar novas cores
    teamSectionA.classList.add(estadoPartida.coresColetes.timeA);
    teamSectionB.classList.add(estadoPartida.coresColetes.timeB);
    
    // Atualizar títulos dos times com nomes das cores
    const titleA = teamSectionA.querySelector('h3');
    const titleB = teamSectionB.querySelector('h3');
    
    const nomeCorA = estadoPartida.coresColetes.timeA === 'black' ? 'PRETO' : 'VERMELHO';
    const nomeCorB = estadoPartida.coresColetes.timeB === 'black' ? 'PRETO' : 'VERMELHO';
    
    titleA.textContent = nomeCorA;
    titleB.textContent = nomeCorB;
    
    // Aplicar cores aos botões de gol
    const goalBtnA = document.getElementById('goal-team-a');
    const goalBtnB = document.getElementById('goal-team-b');
    
    // Limpar classes anteriores
    goalBtnA.classList.remove('black-team', 'red-team');
    goalBtnB.classList.remove('black-team', 'red-team');
    
    // Aplicar novas cores
    goalBtnA.classList.add(`${estadoPartida.coresColetes.timeA}-team`);
    goalBtnB.classList.add(`${estadoPartida.coresColetes.timeB}-team`);
}

// Mostrar modal de seleção de jogador para gol
// Ativar modo de seleção de gol
function ativarModoSelecaoGol(time) {
    console.log('🔥 Tentativa de ativar modo gol:', {
        time: time,
        modoAtivo: modoSelecaoGol.ativo,
        cronometroIniciado: estadoPartida.iniciado,
        cronometroPausado: estadoPartida.pausado
    });
    
    // Verificar se cronômetro está rodando
    if (!estadoPartida.iniciado || estadoPartida.pausado) {
        alert('⚠️ Inicie o cronômetro antes de marcar gols.');
        return;
    }
    
    if (modoSelecaoGol.ativo) {
        // Se já está ativo, desativar
        console.log('🔄 Modo já ativo - desativando');
        desativarModoSelecaoGol();
        return;
    }
    
    console.log('✅ Ativando modo seleção de gol para time', time);
    modoSelecaoGol.ativo = true;
    modoSelecaoGol.time = time;
    
    // Re-renderizar times para mostrar opção de gol contra
    renderizarTime('A', estadoPartida.timeA, 'team-a-players');
    renderizarTime('B', estadoPartida.timeB, 'team-b-players');
    
    // Adicionar classe visual aos jogadores
    aplicarEfeitoSelecaoGol(time);
    
    // Feedback visual no botão
    const botaoGol = document.getElementById(`goal-team-${time.toLowerCase()}`);
    botaoGol.style.background = '#ff6b35';
    botaoGol.innerHTML = '<span class="text">👆 Clique no jogador</span>';
    
    // Mostrar mensagem de instrução
    atualizarStatusCronometro(`⚽ Clique no jogador do TIME ${time} que fez o gol`);
}

// Desativar modo de seleção de gol
function desativarModoSelecaoGol() {
    modoSelecaoGol.ativo = false;
    modoSelecaoGol.time = null;
    
    // Re-renderizar times para remover opção de gol contra
    renderizarTime('A', estadoPartida.timeA, 'team-a-players');
    renderizarTime('B', estadoPartida.timeB, 'team-b-players');
    
    // Remover efeitos visuais
    removerEfeitoSelecaoGol();
    
    // Restaurar botões
    restaurarBotoesGol();
    
    // Restaurar status
    atualizarStatusCronometro(estadoPartida.iniciado ? 'Em andamento' : 'Pronto para iniciar');
}

// Aplicar efeito visual de seleção
function aplicarEfeitoSelecaoGol(time) {
    const teamSection = time === 'A' ? 
        document.querySelector('.team-section:first-child') :
        document.querySelector('.team-section:last-child');
    
    teamSection.classList.add('modo-selecao-gol');
    
    // Adicionar event listeners temporários nos nomes dos jogadores
    const jogadorElements = teamSection.querySelectorAll('.player-name');
    jogadorElements.forEach(element => {
        element.style.cursor = 'pointer';
        element.style.background = 'rgba(255, 107, 53, 0.2)';
        element.style.borderRadius = '5px';
        element.style.padding = '5px';
        element.style.border = '2px dashed #ff6b35';
        element.setAttribute('data-clicavel-gol', 'true');
    });
}

// Remover efeito visual de seleção
function removerEfeitoSelecaoGol() {
    document.querySelectorAll('.team-section').forEach(section => {
        section.classList.remove('modo-selecao-gol');
    });
    
    document.querySelectorAll('[data-clicavel-gol]').forEach(element => {
        element.style.cursor = '';
        element.style.background = '';
        element.style.borderRadius = '';
        element.style.padding = '';
        element.style.border = '';
        element.removeAttribute('data-clicavel-gol');
    });
}

// Restaurar botões de gol
function restaurarBotoesGol() {
    const botaoA = document.getElementById('goal-team-a');
    const botaoB = document.getElementById('goal-team-b');
    
    botaoA.style.background = '';
    botaoB.style.background = '';
    botaoA.innerHTML = '<span class="text">Gol ⚽</span>';
    botaoB.innerHTML = '<span class="text">Gol ⚽</span>';
}

async function mostrarModalGol_OLD(time) {
    const modal = document.getElementById('modal-jogador-gol');
    const titulo = document.getElementById('modal-gol-titulo');
    const lista = document.getElementById('lista-jogadores-gol');
    
    titulo.textContent = `⚽ Quem fez o gol? - TIME ${time}`;
    
    const jogadores = time === 'A' ? estadoPartida.timeA : estadoPartida.timeB;
    
    lista.innerHTML = '';
    for (const jogadorId of jogadores) {
        // Buscar dados do jogador
        const todosJogadores = await obterJogadores();
        const jogador = todosJogadores.find(j => j.id === jogadorId);
        if (!jogador) continue;
        
        const golsNaPartida = estadoPartida.golsPartida[jogadorId] || 0;
        
        const item = document.createElement('div');
        item.className = 'jogador-gol-item';
        item.innerHTML = `
            <div>
                <div class="jogador-gol-nome">${jogador.nome}</div>
                <div class="jogador-gol-stats">
                    <span>Gols na partida: ${golsNaPartida}</span>
                </div>
            </div>
            <button class="jogador-gol-btn" onclick="selecionarJogadorGol('${jogadorId}', '${time}', '${jogador.nome}')">
                ⚽ Gol!
            </button>
        `;
        
        lista.appendChild(item);
    }
    
    modal.style.display = 'flex';
}

// Fechar modal de gol
// Selecionar jogador para gol
async function selecionarJogadorGol(jogadorId, time, nomeJogador) {
    console.log('⚽ selecionarJogadorGol chamada:', {
        jogadorId: jogadorId,
        time: time,
        nomeJogador: nomeJogador,
        modoSelecaoAtivo: modoSelecaoGol.ativo,
        modoSelecaoTime: modoSelecaoGol.time
    });
    
    // Verificar se o modo de seleção está ativo para este time
    if (!modoSelecaoGol.ativo || modoSelecaoGol.time !== time) {
        console.log('❌ Modo seleção não ativo ou time diferente');
        return;
    }
    
    // Desativar modo de seleção
    desativarModoSelecaoGol();
    
    await marcarGol(jogadorId, time, nomeJogador);
}

async function marcarGol(jogadorId, time, nomeJogador) {
    try {
        if (!estadoPartida.iniciado) {
            alert('⚠️ Inicie o cronômetro antes de marcar gols.');
            return;
        }
        
        // Atualizar placar
        if (time === 'A') {
            estadoPartida.placarA++;
        } else {
            estadoPartida.placarB++;
        }
        
        // Atualizar gols do jogador
        estadoPartida.golsPartida[jogadorId] = (estadoPartida.golsPartida[jogadorId] || 0) + 1;
        
        // Salvar no banco
        console.log('💾 Salvando gol no banco:', {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB,
            jogador: nomeJogador,
            time: time
        });
        
        // Salvar placar atualizado na tabela jogos
        const resultadoPlacar = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB
        });
        
        // Salvar gol individual na tabela gols
        const resultadoGol = await Database.registrarGol({
            jogo_id: estadoPartida.jogoId,
            jogador_id: jogadorId,
            time: time
        });
        
        if (!resultadoPlacar?.success || !resultadoGol?.success) {
            console.error('❌ Falha ao salvar gol:', {
                placar: resultadoPlacar?.error,
                gol: resultadoGol?.error
            });
            alert('❌ Erro ao salvar gol no banco de dados!');
        } else {
            console.log('✅ Gol salvo com sucesso!');
        }
        
        // Atualizar interface
        await renderizarPartida();
        
    } catch (error) {
        console.error('Erro ao marcar gol:', error);
        alert('❌ Erro ao marcar gol.');
    }
}

// Marcar gol contra (sem contabilizar estatística para jogador)
async function marcarGolContra(timeBeneficiado) {
    try {
        if (!estadoPartida.iniciado) {
            alert('⚠️ Inicie o cronômetro antes de marcar gols.');
            return;
        }
        
        // Definir qual time fez o gol contra
        const timeQueFezGolContra = timeBeneficiado === 'A' ? 'B' : 'A';
        const nomeTimeBeneficiado = timeBeneficiado === 'A' ? 'Time A' : 'Time B';
        const nomeTimeQueFez = timeQueFezGolContra === 'A' ? 'Time A' : 'Time B';
        
        if (!confirm(`🔄 Confirmar gol contra?\n\n${nomeTimeQueFez} fez gol contra a favor do ${nomeTimeBeneficiado}.`)) {
            return;
        }
        
        // CORRIGIDO: Atualizar placar do time que recebe o benefício
        if (timeBeneficiado === 'A') {
            estadoPartida.placarA++; // Gol contra a favor do Time A
        } else {
            estadoPartida.placarB++; // Gol contra a favor do Time B
        }
        
        // Salvar no banco
        console.log('💾 Salvando gol contra no banco:', {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB,
            gol_contra: true,
            time_beneficiado: timeBeneficiado,
            time_que_fez_gol_contra: timeQueFezGolContra
        });
        
        // Salvar placar atualizado na tabela jogos
        const resultadoPlacar = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB
        });
        
        // Registrar gol contra na tabela gols (sem jogador específico)
        const resultadoGol = await Database.registrarGolContra({
            jogo_id: estadoPartida.jogoId,
            time_gol_contra: timeQueFezGolContra,
            time_beneficiado: timeBeneficiado
        });
        
        if (!resultadoPlacar?.success) {
            console.error('❌ Falha ao salvar gol contra:', resultadoPlacar?.error);
            alert('❌ Erro ao salvar gol contra no banco de dados!');
        } else {
            console.log('✅ Gol contra salvo com sucesso!');
            alert(`✅ Gol contra marcado!\n${nomeTimeQueFez} fez gol contra a favor do ${nomeTimeBeneficiado}!`);
        }
        
        // Atualizar interface
        await renderizarPartida();
        
        // Verificar fim de jogo
        await verificarFimDeJogo();
        
    } catch (error) {
        console.error('Erro ao marcar gol contra:', error);
        alert('❌ Erro ao marcar gol contra.');
    }
}

// Mostrar opções do VAR
async function mostrarVAR() {
    // Buscar último gol da partida
    const resultadoGols = await Database.buscarGolsPorJogo(estadoPartida.jogoId);
    
    if (!resultadoGols.success || !resultadoGols.data || resultadoGols.data.length === 0) {
        alert('⚠️ Não há gols para desfazer.');
        return;
    }
    
    const ultimoGol = resultadoGols.data[resultadoGols.data.length - 1];
    
    // Verificar se é gol contra ou gol normal
    let mensagem;
    if (ultimoGol.gol_contra) {
        // É um gol contra
        const timeBeneficiado = ultimoGol.time === 'A' ? 'Time A' : 'Time B';
        const timeQueFez = ultimoGol.time_gol_contra === 'A' ? 'Time A' : 'Time B';
        mensagem = `Desfazer último gol contra?\n\n${timeQueFez} fez gol contra a favor do ${timeBeneficiado}.`;
    } else {
        // É um gol normal
        const nomeJogador = ultimoGol.jogadores ? ultimoGol.jogadores.nome : 'Jogador';
        mensagem = `Desfazer último gol de ${nomeJogador}?`;
    }
    
    mostrarModal(
        '📺 VAR',
        mensagem,
        () => desfazerUltimoGol(ultimoGol)
    );
}

// Desfazer último gol (VAR)
async function desfazerUltimoGol(gol) {
    try {
        
        // Remover gol da tabela
        const resultadoRemocao = await Database.deletarGol(gol.id);
        
        if (!resultadoRemocao.success) {
            throw new Error('Falha ao remover gol do banco');
        }
        
        // Atualizar placar baseado no tipo de gol
        if (gol.gol_contra) {
            // É gol contra - diminuir do time que recebeu o benefício
            if (gol.time === 'A') {
                estadoPartida.placarA--;
            } else {
                estadoPartida.placarB--;
            }
            console.log('📺 VAR: Gol contra desfeito');
        } else {
            // É gol normal - diminuir do time que marcou
            if (gol.time === 'A') {
                estadoPartida.placarA--;
            } else {
                estadoPartida.placarB--;
            }
            
            // Atualizar gols do jogador (só para gols normais)
            if (gol.jogador_id && estadoPartida.golsPartida[gol.jogador_id] > 0) {
                estadoPartida.golsPartida[gol.jogador_id]--;
            }
            console.log('📺 VAR: Gol normal desfeito');
        }
        
        // Salvar placar atualizado
        const resultadoPlacar = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB
        });
        
        if (!resultadoPlacar.success) {
            throw new Error('Falha ao atualizar placar');
        }
        
        // Atualizar interface
        await renderizarPartida();
        
        // Mostrar confirmação
        const tipoGol = gol.gol_contra ? 'gol contra' : 'gol';
        alert(`✅ ${tipoGol.charAt(0).toUpperCase() + tipoGol.slice(1)} desfeito com sucesso!`);
        
        fecharModal();
        
    } catch (error) {
        console.error('Erro ao desfazer ação:', error);
        alert('❌ Erro ao desfazer ação.');
    }
}

// Funções do Modal Cancelar Partida
function mostrarModalCancelarPartida() {
    const modal = document.getElementById('modal-cancelar-partida');
    if (modal) {
        modal.style.display = 'flex';
        // Prevenir scroll do body
        document.body.style.overflow = 'hidden';
    }
}

function fecharModalCancelarPartida() {
    const modal = document.getElementById('modal-cancelar-partida');
    if (modal) {
        modal.style.display = 'none';
        // Restaurar scroll do body
        document.body.style.overflow = '';
    }
}

// Finalizar partida
// Função para cancelar partida (só no início, sem gols)
async function cancelarPartida() {
    // Fechar modal primeiro
    fecharModalCancelarPartida();
    
    // Verificar se há gols registrados
    if (estadoPartida.placarA > 0 || estadoPartida.placarB > 0) {
        alert('❌ Não é possível cancelar a partida após gols terem sido marcados.');
        return;
    }
    
    try {
        console.log('🔄 Cancelando partida:', estadoPartida.jogoId);
        
        // Parar cronômetro se estiver rodando
        if (intervaloCronometro) {
            clearInterval(intervaloCronometro);
            intervaloCronometro = null;
        }
        
        // Excluir jogo do banco de dados
        const resultado = await excluirJogo(estadoPartida.jogoId);
        
        if (resultado) {
            console.log('✅ Partida cancelada com sucesso');
            alert('✅ Partida cancelada! Voltando para a fila...');
            
            // Redirecionar para fila
            window.location.href = 'fila.html';
        } else {
            throw new Error('Erro ao excluir jogo do banco');
        }
        
    } catch (error) {
        console.error('Erro ao cancelar partida:', error);
        alert('❌ Erro ao cancelar partida. Tente novamente.');
    }
}

async function finalizarPartida() {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    if (estadoPartida.placarA > estadoPartida.placarB) {
        // Vitória do Time A
        await mostrarModalConfirmarVitoria('A', nomeCorTimeA);
    } else if (estadoPartida.placarB > estadoPartida.placarA) {
        // Vitória do Time B
        await mostrarModalConfirmarVitoria('B', nomeCorTimeB);
    } else {
        // Empate - mostrar modal de confirmação com seleção
        mostrarModalConfirmarEmpate();
    }
}

// FUNÇÃO DESATIVADA - Modal de desempate movido para o modal de fim de tempo
// Mostrar modal de desempate
/*
function mostrarModalDesempate() {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Obter emojis das cores
    const emojiTimeA = estadoPartida.coresColetes.timeA === 'preto' ? '⚫' : '🔴';
    const emojiTimeB = estadoPartida.coresColetes.timeB === 'preto' ? '⚫' : '🔴';
    
    const modalContent = `
        <div style="text-align: center;">
            <h3>🤝 Empate ${estadoPartida.placarA}x${estadoPartida.placarB}</h3>
            <p>Escolha qual time terá <strong>prioridade na fila</strong>:</p>
            <div style="margin: 20px 0; display: flex; gap: 15px; justify-content: center;">
                <button onclick="finalizarComPrioridade('A')" style="background: #333; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    ${emojiTimeA} ${nomeCorTimeA}
                </button>
                <button onclick="finalizarComPrioridade('B')" style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    ${emojiTimeB} ${nomeCorTimeB}
                </button>
            </div>
            <p style="font-size: 12px; color: #666;">Time com prioridade ficará em posição melhor na fila</p>
        </div>
    `;
    
    // Reutilizar o modal existente
    document.getElementById('modal-mensagem').innerHTML = modalContent;
    document.getElementById('modal-titulo').textContent = 'Desempate';
    document.getElementById('modal-confirmacao').style.display = 'flex';
    
    // Esconder botões padrão do modal
    document.querySelector('.modal-buttons').style.display = 'none';
}

// FUNÇÃO DESATIVADA - Finalizar com prioridade específica no empate
window.finalizarComPrioridade = function(timePrioridade) {
    estadoPartida.timePrioridadeEmpate = timePrioridade;
    console.log(`🎯 Empate com prioridade para TIME ${timePrioridade}`);
    
    // Restaurar modal para estado normal
    document.querySelector('.modal-buttons').style.display = 'flex';
    
    fecharModal();
    processarFinalizacao();
}
*/

// Processar finalização da partida
async function processarFinalizacao() {
    // Esconder aviso de navegação bloqueada
    esconderAvisoNavegacaoBloqueada();
    try {
        mostrarLoading(true);
        
        // Determinar vencedor
        let timeVencedor = null;
        let isEmpate = false;
        
        if (estadoPartida.placarA > estadoPartida.placarB) {
            timeVencedor = 'A';
        } else if (estadoPartida.placarB > estadoPartida.placarA) {
            timeVencedor = 'B';
        } else {
            // Empate - usar prioridade escolhida
            isEmpate = true;
            timeVencedor = null; // Manter null para empate
        }
        
        console.log('🏁 Iniciando finalização da partida:', {
            placarA: estadoPartida.placarA,
            placarB: estadoPartida.placarB,
            timeVencedor: timeVencedor,
            isEmpate: isEmpate,
            timePrioridadeEmpate: estadoPartida.timePrioridadeEmpate,
            vitoriasConsecutivas: estadoPartida.vitoriasConsecutivas,
            timeA: estadoPartida.timeA,
            timeB: estadoPartida.timeB,
            golsPartida: estadoPartida.golsPartida
        });
        
        // Finalizar jogo no banco
        try {
            const resultado = await atualizarJogoNoBanco(estadoPartida.jogoId, {
                status: 'finalizado',
                time_vencedor: timeVencedor,
                data_fim: new Date(),
                tempo_decorrido: calcularTempoDecorrido()
            });
            
            if (resultado.success) {
                console.log('✅ Jogo finalizado no banco');
            } else {
                console.warn('⚠️ Erro ao finalizar no banco:', resultado.error);
                if (!resultado.networkError) {
                    throw new Error(resultado.error);
                }
            }
        } catch (error) {
            console.error('❌ Erro crítico ao finalizar jogo:', error);
            if (!error.message?.includes('Erro de conexão')) {
                alert('❌ Erro ao finalizar partida no banco de dados!');
                mostrarLoading(false);
                return;
            }
        }
        
        // Atualizar estatísticas dos jogadores
        console.log('🔄 Iniciando atualização de estatísticas...');
        try {
            await atualizarEstatisticasJogadores(timeVencedor);
            console.log('✅ Estatísticas dos jogadores atualizadas');
        } catch (errorEstatisticas) {
            console.error('❌ Erro ao atualizar estatísticas:', errorEstatisticas);
        }
        
        // Verificar conectividade antes de processar rotação
        console.log('🔍 Testando conectividade antes de processar rotação...');
        const conectividade = await testarConectividade();
        
        if (!conectividade.success) {
            console.error('❌ Sem conectividade - não é possível processar rotação da fila');
            console.error('Erro:', conectividade.error);
            
            // Mostrar aviso ao usuário
            alert(`⚠️ Sem conexão com o banco de dados!\n\nA partida foi finalizada, mas as mudanças na fila não foram salvas.\n\nErro: ${conectividade.error}\n\nVerifique sua conexão e recarregue a página.`);
            
            fecharModal();
            mostrarLoading(false);
            return;
        }

        // Processar vitórias consecutivas e rotação
        console.log('🔄 Iniciando processamento de rotação da fila...');
        try {
            // Verificar se as funções de rotação existem
            console.log('🔍 Verificando funções de rotação disponíveis:', {
                Database: typeof Database,
                rotacionarApenasTimeA: typeof Database.rotacionarApenasTimeA,
                rotacionarApenasTimeB: typeof Database.rotacionarApenasTimeB,
                rotacionarAmbosOsTimes: typeof Database.rotacionarAmbosOsTimes,
                atualizarVitoriasConsecutivas: typeof Database.atualizarVitoriasConsecutivas
            });
            
            await processarRotacaoFila(timeVencedor);
            console.log('✅ Rotação da fila processada');
            
            // Atualizar display de vitórias consecutivas após rotação
            await atualizarDisplayVitoriasConsecutivas();
        } catch (errorRotacao) {
            console.error('❌ Erro ao processar rotação:', errorRotacao);
            alert(`❌ Erro ao processar rotação da fila!\n\nErro: ${errorRotacao.message}\n\nA partida foi finalizada, mas a fila pode não ter sido atualizada corretamente.`);
        }
        
        fecharModal();
        mostrarLoading(false);
        
        // Redirecionar para fila
        alert('✅ Partida finalizada com sucesso!');
        window.location.href = 'fila.html';
        
    } catch (error) {
        console.error('Erro ao finalizar partida:', error);
        mostrarLoading(false);
        alert('❌ Erro ao finalizar partida.');
    }
}

// Atualizar estatísticas dos jogadores
async function atualizarEstatisticasJogadores(timeVencedor) {
    const todosJogadores = [...estadoPartida.timeA, ...estadoPartida.timeB];
    
    console.log('👥 Atualizando estatísticas para jogadores:', {
        todosJogadores: todosJogadores.length,
        timeVencedor: timeVencedor,
        golsPartida: estadoPartida.golsPartida
    });
    
    for (const jogadorId of todosJogadores) {
        const isVencedor = (timeVencedor === 'A' && estadoPartida.timeA.includes(jogadorId)) ||
                          (timeVencedor === 'B' && estadoPartida.timeB.includes(jogadorId));
        
        const golsNaPartida = estadoPartida.golsPartida[jogadorId] || 0;
        
        const incrementos = {
            jogos: 1,
            vitorias: isVencedor ? 1 : 0,
            gols: golsNaPartida
        };
        
        console.log(`📊 Atualizando jogador ${jogadorId}:`, incrementos);
        
        try {
            const resultado = await Database.atualizarEstatisticasJogador(jogadorId, incrementos);
            
            if (resultado) {
                console.log(`✅ Estatísticas atualizadas para jogador ${jogadorId}`);
            } else {
                console.error(`❌ Falha ao atualizar estatísticas para jogador ${jogadorId}`);
                throw new Error('Falha na atualização das estatísticas');
            }
        } catch (error) {
            console.error(`❌ Erro ao atualizar estatísticas do jogador ${jogadorId}:`, error);
            if (error.message?.includes('Failed to fetch')) {
                console.warn(`⚠️ Erro de rede - estatísticas do jogador ${jogadorId} não salvas`);
                continue; // Continua com próximo jogador
            }
            throw error; // Re-lança outros tipos de erro
        }
    }
}

// Processar rotação da fila
// NOVA LÓGICA: usar tabela fila.vitorias_consecutivas_time para controle persistente
// - Time A vence: +1 vitória consecutiva, Time B sai se < 3, ambos saem se ≥ 3
// - Time B vence: Time B assume posição A com 1 vitória, ex-Time A sai
// - Empate: ambos saem, próximos entram com 0 vitórias
async function processarRotacaoFila(timeVencedor) {
    // Obter vitórias consecutivas atuais do banco de dados
    const vitoriasAtuais = await obterVitoriasConsecutivasTimeA();
    
    console.log('🔄 Processando rotação da fila:', {
        timeVencedor: timeVencedor,
        vitoriasAtuais: vitoriasAtuais,
        limiteVitorias: estadoPartida.limiteVitorias
    });
    
    // Lógica de rotação baseada no resultado e vitórias consecutivas
    if (timeVencedor === null) {
        // Empate - ambos os times saem, resetar todas as vitórias
        console.log('🤝 Empate - resetando vitórias e rotacionando ambos os times');
        await resetarTodasVitoriasConsecutivas();
        
        // Rotacionar com prioridade
        const timePrioridade = estadoPartida.timePrioridadeEmpate;
        console.log(`🎯 Rotacionando com prioridade para TIME ${timePrioridade}`);
        
        const resultadoRotacao = await Database.rotacionarEmpateComPrioridade(timePrioridade);
        console.log('🔄 Ambos os times rotacionados com prioridade:', resultadoRotacao);
        
    } else if (timeVencedor === 'A') {
        // Time A venceu - continua sequência
        const novasVitorias = vitoriasAtuais + 1;
        console.log(`🏆 Time A venceu - vitórias consecutivas: ${vitoriasAtuais} → ${novasVitorias}`);
        
        await atualizarVitoriasConsecutivasTimeA(novasVitorias);
        
        console.log(`🔍 DEBUG: novasVitorias (${novasVitorias}) >= limiteVitorias (${estadoPartida.limiteVitorias})? ${novasVitorias >= estadoPartida.limiteVitorias}`);
        
        if (novasVitorias >= estadoPartida.limiteVitorias) {
            // Time A atingiu limite - resetar todas as vitórias e ambos saem
            console.log('🚫 Time A atingiu limite - resetando vitórias e rotacionando ambos os times (vencedor com prioridade)');
            await resetarTodasVitoriasConsecutivas();
            
            const resultadoRotacao = await Database.rotacionarTerceiraVitoriaConsecutiva('A');
            console.log('🔄 Ambos os times rotacionados com prioridade para vencedor:', resultadoRotacao);
        } else {
            // Time A continua, Time B sai - manter vitórias do Time A
            console.log('➡️ Time A continua - rotacionando apenas Time B');
            const resultadoRotacao = await Database.rotacionarApenasTimeB();
            console.log('🔄 Time B rotacionado:', resultadoRotacao);
            
            // Após rotação, Time A continua com as mesmas vitórias consecutivas
            // Novos jogadores do Time B começam com 0 vitórias
        }
    } else {
        // Time B venceu - Time B inicia nova sequência com 1 vitória
        console.log('🔴 Time B venceu - rotacionando Time A, Time B vira novo Time A com 1 vitória');
        
        const resultadoRotacao = await Database.rotacionarApenasTimeA(); // Time A sai, Time B fica
        console.log('� Time A rotacionado:', resultadoRotacao);
        
        // Após rotação, o ex-Time B agora é Time A com 1 vitória consecutiva
        await atualizarVitoriasConsecutivasTimeA(1);
    }
}

// Iniciar sincronização automática
function iniciarSincronizacao() {
    // Atualizar display a cada segundo
    setInterval(() => {
        atualizarDisplayCronometro();
    }, 1000);
    
    // Salvar estado periodicamente é feito dentro de atualizarDisplayCronometro
}

// Funções auxiliares
function mostrarModal(titulo, mensagem, callback) {
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-mensagem').textContent = mensagem;
    document.getElementById('modal-confirmacao').style.display = 'block';
    
    // Guardar callback para confirmação
    window.modalCallback = callback;
}

function fecharModal() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    window.modalCallback = null;
}

function confirmarAcao() {
    if (window.modalCallback) {
        window.modalCallback();
    }
}

function mostrarLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Função para voltar à fila (com confirmação se jogo ativo)
function voltarParaFila() {
    if (estadoPartida.iniciado && !estadoPartida.pausado) {
        if (confirm('⚠️ A partida está em andamento. Tem certeza que deseja sair?')) {
            window.location.href = 'fila.html';
        }
    } else {
        window.location.href = 'fila.html';
    }
}

// Mostrar aviso de navegação bloqueada
function mostrarAvisoNavegacaoBloqueada() {
    let aviso = document.getElementById('aviso-navegacao-bloqueada');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'aviso-navegacao-bloqueada';
        aviso.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff6b6b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: bold;
            z-index: 1100;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            text-align: center;
            border: 2px solid #ff5252;
            animation: pulse 2s infinite;
        `;
        aviso.innerHTML = '🔒 NAVEGAÇÃO BLOQUEADA<br><small>Cronômetro pausado</small>';
        
        // Adicionar animação CSS se não existir
        if (!document.getElementById('aviso-navegacao-styles')) {
            const styles = document.createElement('style');
            styles.id = 'aviso-navegacao-styles';
            styles.innerHTML = `
                @keyframes pulse {
                    0% { opacity: 1; transform: translateX(-50%) scale(1); }
                    50% { opacity: 0.8; transform: translateX(-50%) scale(1.05); }
                    100% { opacity: 1; transform: translateX(-50%) scale(1); }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(aviso);
    }
    aviso.style.display = 'block';
}

// Esconder aviso de navegação bloqueada
function esconderAvisoNavegacaoBloqueada() {
    const aviso = document.getElementById('aviso-navegacao-bloqueada');
    if (aviso) {
        aviso.style.display = 'none';
    }
}

// Confirmar encerramento (footer)
function confirmarEncerramento() {
    mostrarModal(
        '🏁 Encerrar Sessão',
        'Isso encerrará toda a sessão. Deseja continuar?',
        () => {
            window.location.href = 'index.html';
        }
    );
}

// Mostrar tela sem jogo ativo
function mostrarTelaSemanJogo() {
    mostrarLoading(false);
    
    // Esconder conteúdo principal
    document.querySelector('.container').style.display = 'none';
    
    // Mostrar tela sem jogo
    const noGameScreen = document.getElementById('no-game-screen');
    noGameScreen.style.display = 'flex';
    
    // Configurar event listeners dos botões
    document.getElementById('go-to-queue-btn').addEventListener('click', () => {
        window.location.href = 'fila.html';
    });
    
    document.getElementById('refresh-game-btn').addEventListener('click', async () => {
        try {
            mostrarLoading(true);
            noGameScreen.style.display = 'none';
            
            // Verificar novamente se há jogo ativo
            const jogoAtivo = await obterJogoAtivo();
            if (jogoAtivo) {
                window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
            } else {
                // Ainda não há jogo, mostrar tela novamente
                setTimeout(() => {
                    mostrarTelaSemanJogo();
                }, 1000);
            }
        } catch (error) {
            console.error('Erro ao verificar jogo:', error);
            mostrarTelaSemanJogo();
        }
    });
}

// Esconder tela sem jogo
function esconderTelaSemanJogo() {
    document.getElementById('no-game-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
}

// Função para aplicar restrições visuais para jogadores na partida
function aplicarRestricoesVisuaisPartida() {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'player') {
        console.log('👁️ Aplicando modo visualização para jogador na partida');
        
        setTimeout(() => {
            // Botões de controle da partida que jogadores não podem usar
            const botoesRestringir = [
                '#play-pause-btn',  // Play/Pause cronômetro
                '#reset-btn',       // Reset cronômetro
                '#var-btn',         // VAR
                '#finish-btn',      // Finalizar partida
                '.goal-btn',        // Botões de gol
                '.team-color-btn',  // Botões de cores dos coletes
                '.control-button',  // Outros controles
                '.admin-controls'   // Controles administrativos
            ];
            
            botoesRestringir.forEach(selector => {
                const elementos = document.querySelectorAll(selector);
                elementos.forEach(el => {
                    el.style.display = 'none';
                });
            });
            
            // Adicionar aviso de modo visualização na partida
            const container = document.querySelector('.container');
            if (container) {
                const avisoDiv = document.createElement('div');
                avisoDiv.innerHTML = `
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
                        <h4 style="margin: 0 0 8px 0; font-size: 1.1rem;">⚽ Modo Espectador</h4>
                        <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Você está acompanhando a partida como jogador. Controles restritos.</p>
                    </div>
                `;
                container.insertBefore(avisoDiv, container.firstChild);
            }
            
            // Desabilitar cliques em elementos interativos
            const elementosInterativos = document.querySelectorAll('button, .clickable, .interactive');
            elementosInterativos.forEach(el => {
                const isControlButton = el.classList.contains('goal-btn') || 
                                       el.classList.contains('control-button') ||
                                       el.id.includes('btn');
                
                if (isControlButton) {
                    el.style.cursor = 'not-allowed';
                    el.title = 'Ação restrita para jogadores';
                    el.onclick = null;
                    el.removeAttribute('onclick');
                    
                    // Remover event listeners
                    const newEl = el.cloneNode(true);
                    el.parentNode.replaceChild(newEl, el);
                }
            });
            
        }, 1500); // Aguardar mais tempo para garantir que a partida foi carregada
    }
}