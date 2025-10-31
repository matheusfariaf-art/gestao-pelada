// Estado da aplicação
let jogadoresDisponiveis = [];
let jogadoresSelecionados = [];
let timesFormados = [];
let mostrarEstrelas = false; // Inicia desmarcado
let regrasAtivas = null;

// Elementos DOM
const btnSelectAll = document.getElementById('btn-select-all');
const btnToggleStars = document.getElementById('btn-toggle-stars');
const btnSortear = document.getElementById('btn-sortear');
const btnResort = document.getElementById('btn-resort');
const btnConfirmar = document.getElementById('btn-confirmar');
const listaJogadores = document.getElementById('lista-jogadores');
const selectedCount = document.getElementById('selected-count');
const resultadoSorteio = document.getElementById('resultado-sorteio');
const teamsContainer = document.getElementById('teams-container');

// Inicialização
document.addEventListener('DOMContentLoaded', inicializar);

async function inicializar() {
    try {
        await carregarRegras();
        await carregarJogadores();
        configurarEventListeners();
        configurarEstadoInicial();
    } catch (error) {
        console.error('Erro na inicialização:', error);
        mostrarMensagem('❌ Erro ao carregar a página', 'error');
    }
}

// Configurar estado inicial da interface
function configurarEstadoInicial() {
    // Configurar botão de estrelas para estado desmarcado
    btnToggleStars.classList.remove('active');
    btnToggleStars.innerHTML = `
        <span class="emoji">⭐</span>
        <span>Mostrar Estrelas</span>
    `;
    
    // Ocultar todas as estrelas por padrão
    document.querySelectorAll('.player-stars').forEach(stars => stars.classList.add('hidden'));
}

// Event Listeners
function configurarEventListeners() {
    // Selecionar todos
    btnSelectAll.addEventListener('click', toggleSelectAll);

    // Toggle estrelas
    btnToggleStars.addEventListener('click', toggleStars);

    // Sortear times
    btnSortear.addEventListener('click', sortearTimes);

    // Re-sortear
    btnResort.addEventListener('click', sortearTimes);

    // Confirmar times
    btnConfirmar.addEventListener('click', confirmarTimes);
}

// Carregar regras do banco
async function carregarRegras() {
    try {
        const resultado = await Database.buscarRegras();
        
        if (resultado.success && resultado.data && resultado.data.length > 0) {
            regrasAtivas = resultado.data[0];
        } else {
            // Usar regras padrão
            regrasAtivas = {
                jogadores_por_time: 6,
                limite_jogadores: 30
            };
        }
    } catch (error) {
        console.error('Erro ao carregar regras:', error);
        // Usar regras padrão em caso de erro
        regrasAtivas = {
            jogadores_por_time: 6,
            limite_jogadores: 30
        };
    }
}

// Carregar jogadores do banco
async function carregarJogadores() {
    try {
        listaJogadores.innerHTML = `
            <div class="loading-state">
                <span class="emoji">⏳</span>
                <p>Carregando jogadores...</p>
            </div>
        `;

        const resultado = await Database.buscarJogadores();
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }

        jogadoresDisponiveis = resultado.data || [];
        
        if (jogadoresDisponiveis.length === 0) {
            listaJogadores.innerHTML = `
                <div class="empty-state">
                    <span class="emoji">😴</span>
                    <p>Nenhum jogador cadastrado ainda</p>
                    <p><a href="cadastro.html">Cadastre jogadores primeiro</a></p>
                </div>
            `;
            return;
        }

        renderizarListaJogadores();
        
    } catch (error) {
        console.error('Erro ao carregar jogadores:', error);
        listaJogadores.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <p>Erro ao carregar jogadores</p>
                <p><small>${error.message}</small></p>
            </div>
        `;
    }
}

// Renderizar lista de jogadores
function renderizarListaJogadores() {
    listaJogadores.innerHTML = jogadoresDisponiveis.map(jogador => {
        const nivel = jogador.nivel_habilidade || 3;
        const estrelas = '⭐'.repeat(nivel);
        const estrelasClass = mostrarEstrelas ? '' : 'hidden';
        
        return `
            <button class="player-button" data-id="${jogador.id}" onclick="toggleJogador('${jogador.id}')">
                <span class="player-name">${jogador.nome}</span>
                <span class="player-stars ${estrelasClass}">${estrelas}</span>
            </button>
        `;
    }).join('');
}

// Toggle seleção de jogador
function toggleJogador(jogadorId) {
    const playerButton = document.querySelector(`[data-id="${jogadorId}"]`);
    
    if (jogadoresSelecionados.includes(jogadorId)) {
        // Desselecionar
        playerButton.classList.remove('selected');
        jogadoresSelecionados = jogadoresSelecionados.filter(id => id !== jogadorId);
    } else {
        // Selecionar
        playerButton.classList.add('selected');
        jogadoresSelecionados.push(jogadorId);
    }
    
    atualizarContadorSelecao();
    validarSelecao();
}

// Toggle selecionar todos
function toggleSelectAll() {
    const todosSelecionados = jogadoresSelecionados.length === jogadoresDisponiveis.length;
    
    if (todosSelecionados) {
        // Desselecionar todos
        jogadoresSelecionados = [];
        document.querySelectorAll('.player-button').forEach(btn => btn.classList.remove('selected'));
        btnSelectAll.classList.remove('active');
        btnSelectAll.innerHTML = `
            <span class="emoji">✅</span>
            <span>Selecionar Todos</span>
        `;
    } else {
        // Selecionar todos
        jogadoresSelecionados = jogadoresDisponiveis.map(j => j.id.toString());
        document.querySelectorAll('.player-button').forEach(btn => btn.classList.add('selected'));
        btnSelectAll.classList.add('active');
        btnSelectAll.innerHTML = `
            <span class="emoji">❌</span>
            <span>Desselecionar Todos</span>
        `;
    }
    
    atualizarContadorSelecao();
    validarSelecao();
}

// Toggle exibição das estrelas
function toggleStars() {
    mostrarEstrelas = !mostrarEstrelas;
    
    if (mostrarEstrelas) {
        btnToggleStars.classList.add('active');
        btnToggleStars.innerHTML = `
            <span class="emoji">⭐</span>
            <span>Ocultar Estrelas</span>
        `;
        document.querySelectorAll('.player-stars').forEach(stars => stars.classList.remove('hidden'));
    } else {
        btnToggleStars.classList.remove('active');
        btnToggleStars.innerHTML = `
            <span class="emoji">⭐</span>
            <span>Mostrar Estrelas</span>
        `;
        document.querySelectorAll('.player-stars').forEach(stars => stars.classList.add('hidden'));
    }
}

// Atualizar contador de seleção
function atualizarContadorSelecao() {
    const count = jogadoresSelecionados.length;
    selectedCount.textContent = `${count} jogador${count !== 1 ? 'es' : ''} selecionado${count !== 1 ? 's' : ''}`;
}

// Validar se pode sortear
function validarSelecao() {
    const jogadoresPorTime = regrasAtivas?.jogadores_por_time || 6;
    const minJogadores = jogadoresPorTime * 2; // Mínimo para 2 times
    const podeSortear = jogadoresSelecionados.length >= minJogadores;
    
    btnSortear.disabled = !podeSortear;
    
    if (!podeSortear && jogadoresSelecionados.length > 0) {
        selectedCount.innerHTML += ` <small style="color: #ff6b6b;">(mín. ${minJogadores} jogadores)</small>`;
    }
}

// Algoritmo de sorteio balanceado
function sortearTimes() {
    try {
        mostrarLoading('Sorteando times...');
        
        // Buscar dados completos dos jogadores selecionados
        const jogadoresSorteio = jogadoresDisponiveis.filter(j => 
            jogadoresSelecionados.includes(j.id.toString())
        );
        
        // Calcular número de times baseado nas regras
        const jogadoresPorTime = regrasAtivas?.jogadores_por_time || 6;
        const totalJogadores = jogadoresSorteio.length;
        
        console.log(`Regras ativas: ${JSON.stringify(regrasAtivas)}`);
        console.log(`Total de jogadores selecionados: ${totalJogadores}`);
        console.log(`Jogadores por time (regra): ${jogadoresPorTime}`);
        
        // PRIORIZAR TIMES COMPLETOS - não distribuir igualmente se sobrar pouco
        let numeroTimes = Math.floor(totalJogadores / jogadoresPorTime);
        const jogadoresRestantes = totalJogadores % jogadoresPorTime;
        
        console.log(`Times completos possíveis: ${numeroTimes}`);
        console.log(`Jogadores restantes: ${jogadoresRestantes}`);
        
        // Sempre criar time para jogadores restantes (se houver)
        if (jogadoresRestantes > 0) {
            numeroTimes += 1;
            console.log(`Adicionando 1 time incompleto (${jogadoresRestantes} jogadores)`);
            console.log(`DECISÃO: ${numeroTimes-1} times completos + 1 incompleto`);
        }
        
        // Mínimo de 2 times para sorteio
        if (numeroTimes < 2) {
            numeroTimes = Math.min(2, Math.floor(totalJogadores / 3));
            console.log(`Ajustando para mínimo de ${numeroTimes} times`);
        }
        
        console.log(`RESULTADO: ${numeroTimes} times serão formados`);
        
        // Separar jogadores por nível
        const jogadoresPorNivel = separarJogadoresPorNivel(jogadoresSorteio);
        
        // Inicializar times vazios
        timesFormados = Array.from({ length: numeroTimes }, (_, i) => ({
            id: i + 1,
            nome: `Time ${i + 1}`,
            jogadores: [],
            nivelMedio: 0,
            cores: ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'][i]
        }));
        
        // Executar sorteio inteligente com padrões
        executarSorteioInteligente(jogadoresPorNivel, timesFormados, jogadoresPorTime);
        
        // Calcular nível médio de cada time
        timesFormados.forEach(time => {
            if (time.jogadores.length > 0) {
                const somaNeveis = time.jogadores.reduce((soma, j) => soma + (j.nivel_habilidade || 3), 0);
                time.nivelMedio = (somaNeveis / time.jogadores.length).toFixed(1);
            }
        });
        
        setTimeout(() => {
            exibirResultado();
        }, 1000);
        
    } catch (error) {
        console.error('Erro no sorteio:', error);
        mostrarMensagem('❌ Erro ao sortear times', 'error');
    }
}

// Embaralhar array
function embaralharArray(array) {
    const arrayCopy = [...array];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
}

// Separar jogadores por nível
function separarJogadoresPorNivel(jogadores) {
    const jogadoresPorNivel = {
        5: [],
        4: [],
        3: [],
        2: [],
        1: []
    };
    
    jogadores.forEach(jogador => {
        const nivel = jogador.nivel_habilidade || 3;
        jogadoresPorNivel[nivel] = jogadoresPorNivel[nivel] || [];
        jogadoresPorNivel[nivel].push(jogador);
    });
    
    // Embaralhar cada nível
    Object.keys(jogadoresPorNivel).forEach(nivel => {
        jogadoresPorNivel[nivel] = embaralharArray(jogadoresPorNivel[nivel]);
    });
    
    return jogadoresPorNivel;
}

// Executar sorteio inteligente com padrões
function executarSorteioInteligente(jogadoresPorNivel, times, jogadoresPorTime) {
    const numeroTimes = times.length;
    
    // Contar jogadores disponíveis por nível
    const count = {
        5: jogadoresPorNivel[5].length,
        4: jogadoresPorNivel[4].length,
        3: jogadoresPorNivel[3].length,
        2: jogadoresPorNivel[2].length,
        1: jogadoresPorNivel[1].length
    };
    
    console.log('Jogadores por nível:', count);
    console.log('Device info:', {
        userAgent: navigator.userAgent,
        isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        touchSupport: 'ontouchstart' in window
    });
    
    // APLICAR PADRÕES CONFORME REGRAS
    console.log('=== VERIFICANDO PADRÕES DE TIMES ===');
    
    // Verificar se Padrão 1 é possível
    if (verificarPadrao1(count, numeroTimes)) {
        console.log('✅ Aplicando Padrão 1: 1x5⭐ + 2x4⭐ + 2x3⭐ + 1x(1-2⭐)');
        mostrarMensagem('🥇 Padrão 1: 1×5⭐ + 2×4⭐ + 2×3⭐ + 1×(1-2⭐)', 'success');
        aplicarPadrao1(jogadoresPorNivel, times, jogadoresPorTime);
    }
    // Senão, verificar se Padrão 2 é possível  
    else if (verificarPadrao2(count, numeroTimes)) {
        console.log('⚠️ Aplicando Padrão 2: 3x4⭐ + 2x3⭐ + 1x(1-2⭐)');
        mostrarMensagem('🥈 Padrão 2: 3×4⭐ + 2×3⭐ + 1×(1-2⭐)', 'warning');
        aplicarPadrao2(jogadoresPorNivel, times, jogadoresPorTime);
    }
    // Fallback: sorteio equilibrado
    else {
        console.log('🔄 Fallback: Aplicando sorteio equilibrado simples');
        mostrarMensagem('🔄 Fallback: Sorteio equilibrado (padrões indisponíveis)', 'info');
        aplicarSorteioEquilibrado(jogadoresPorNivel, times, jogadoresPorTime);
    }
}

// Verificar se Padrão 1 é possível
function verificarPadrao1(count, numeroTimes) {
    // Calcular apenas para times COMPLETOS (6 jogadores)
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 1 para ${timesParaTentar} times completos (de ${numeroTimes} total)`);
    console.log('Necessário por time: 1x5⭐ + 2x4⭐ + 2x3⭐ + 1x(1-2⭐)');
    
    const necessario = {
        5: timesParaTentar * 1,
        4: timesParaTentar * 2,
        3: timesParaTentar * 2,
        baixo: timesParaTentar * 1
    };
    
    const disponivel = {
        5: count[5],
        4: count[4], 
        3: count[3],
        baixo: count[1] + count[2]
    };
    
    console.log('Necessário:', necessario);
    console.log('Disponível:', disponivel);
    
    const possivel = timesParaTentar > 0 && (
        disponivel[5] >= necessario[5] &&
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 1 possível:', possivel, `(para ${timesParaTentar} times)`);
    return possivel;
}

// Verificar se Padrão 2 é possível
function verificarPadrao2(count, numeroTimes) {
    // Calcular apenas para times COMPLETOS (6 jogadores)
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 2 para ${timesParaTentar} times completos (de ${numeroTimes} total)`);
    console.log('Necessário por time: 3x4⭐ + 2x3⭐ + 1x(1-2⭐)');
    
    const necessario = {
        4: timesParaTentar * 3,
        3: timesParaTentar * 2,
        baixo: timesParaTentar * 1
    };
    
    const disponivel = {
        4: count[4],
        3: count[3],
        baixo: count[1] + count[2]
    };
    
    console.log('Necessário:', necessario);
    console.log('Disponível:', disponivel);
    
    const possivel = timesParaTentar > 0 && (
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 2 possível:', possivel, `(para ${timesParaTentar} times)`);
    return possivel;
}

// Aplicar Padrão 1: 1x5⭐ + 2x4⭐ + 2x3⭐ + 1x(1-2⭐)
function aplicarPadrao1(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 1 ===');
    
    // Aplicar padrão apenas nos times que podem ser completos (6 jogadores)
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.min(times.length, Math.floor(totalJogadores / 6));
    
    console.log(`Aplicando padrão em ${timesCompletos} times completos de ${times.length} total`);
    
    for (let i = 0; i < timesCompletos; i++) {
        const time = times[i];
        console.log(`Montando ${time.nome} (completo):`);
        
        // 1 jogador 5 estrelas
        if (jogadoresPorNivel[5].length > 0) {
            const jogador = jogadoresPorNivel[5].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (5⭐)`);
        }
        
        // 2 jogadores 4 estrelas
        for (let j = 0; j < 2 && jogadoresPorNivel[4].length > 0; j++) {
            const jogador = jogadoresPorNivel[4].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (4⭐)`);
        }
        
        // 2 jogadores 3 estrelas
        for (let j = 0; j < 2 && jogadoresPorNivel[3].length > 0; j++) {
            const jogador = jogadoresPorNivel[3].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (3⭐)`);
        }
        
        // 1 jogador 1-2 estrelas
        if (jogadoresPorNivel[2].length > 0) {
            const jogador = jogadoresPorNivel[2].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (2⭐)`);
        } else if (jogadoresPorNivel[1].length > 0) {
            const jogador = jogadoresPorNivel[1].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (1⭐)`);
        }
        
        console.log(`  Total: ${time.jogadores.length} jogadores`);
    }
    
    // Distribuir jogadores restantes (incluindo times incompletos)
    console.log('Distribuindo jogadores restantes...');
    distribuirRestantes(jogadoresPorNivel, times, jogadoresPorTime);
}

// Aplicar Padrão 2: 3x4⭐ + 2x3⭐ + 1x(1-2⭐)
function aplicarPadrao2(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 2 ===');
    
    // Aplicar padrão apenas nos times que podem ser completos (6 jogadores)
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.min(times.length, Math.floor(totalJogadores / 6));
    
    console.log(`Aplicando padrão em ${timesCompletos} times completos de ${times.length} total`);
    
    for (let i = 0; i < timesCompletos; i++) {
        const time = times[i];
        console.log(`Montando ${time.nome} (completo):`);
        
        // 3 jogadores 4 estrelas
        for (let j = 0; j < 3 && jogadoresPorNivel[4].length > 0; j++) {
            const jogador = jogadoresPorNivel[4].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (4⭐)`);
        }
        
        // 2 jogadores 3 estrelas
        for (let j = 0; j < 2 && jogadoresPorNivel[3].length > 0; j++) {
            const jogador = jogadoresPorNivel[3].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (3⭐)`);
        }
        
        // 1 jogador 1-2 estrelas
        if (jogadoresPorNivel[2].length > 0) {
            const jogador = jogadoresPorNivel[2].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (2⭐)`);
        } else if (jogadoresPorNivel[1].length > 0) {
            const jogador = jogadoresPorNivel[1].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (1⭐)`);
        }
        
        console.log(`  Total: ${time.jogadores.length} jogadores`);
    }
    
    // Distribuir jogadores restantes (incluindo times incompletos)
    console.log('Distribuindo jogadores restantes...');
    distribuirRestantes(jogadoresPorNivel, times, jogadoresPorTime);
}

// Aplicar Fallback - distribuição equilibrada
function aplicarFallback(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO FALLBACK ===');
    
    // PRIORIZAR TIMES COMPLETOS - preencher sequencialmente, não serpentina
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.min(times.length, Math.floor(totalJogadores / jogadoresPorTime));
    
    console.log(`Preenchendo ${timesCompletos} times completos primeiro`);
    
    // Preencher times completos primeiro (6 jogadores cada)
    let timeAtual = 0;
    [5, 4, 3, 2, 1].forEach(nivel => {
        console.log(`Distribuindo jogadores nível ${nivel}: ${jogadoresPorNivel[nivel].length}`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Primeiro, preencher times incompletos até chegarem a 6
            let encontrou = false;
            for (let i = 0; i < timesCompletos; i++) {
                if (times[i].jogadores.length < jogadoresPorTime) {
                    const jogador = jogadoresPorNivel[nivel].shift();
                    times[i].jogadores.push(jogador);
                    console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome} (${times[i].jogadores.length}/${jogadoresPorTime})`);
                    encontrou = true;
                    break;
                }
            }
            
            // Se todos os times completos estão cheios, colocar no time incompleto
            if (!encontrou && jogadoresPorNivel[nivel].length > 0) {
                for (let i = timesCompletos; i < times.length; i++) {
                    if (times[i].jogadores.length < jogadoresPorTime) {
                        const jogador = jogadoresPorNivel[nivel].shift();
                        times[i].jogadores.push(jogador);
                        console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome} (INCOMPLETO)`);
                        encontrou = true;
                        break;
                    }
                }
            }
            
            // Se não encontrou lugar, sair do loop
            if (!encontrou) break;
        }
    });
    
    console.log('Times após fallback:');
    times.forEach(time => {
        console.log(`${time.nome}: ${time.jogadores.length} jogadores`);
    });
}

// Nova função de distribuição equilibrada
function aplicarDistribuicaoEquilibrada(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO DISTRIBUIÇÃO EQUILIBRADA ===');
    
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.floor(totalJogadores / jogadoresPorTime);
    
    console.log(`Distribuindo ${totalJogadores} jogadores em ${times.length} times (${timesCompletos} completos)`);
    
    // Distribuir de forma equilibrada - um jogador de cada nível por vez em cada time
    let timeAtual = 0;
    
    // Primeiro, distribuir jogadores de alto nível (5⭐ e 4⭐) de forma equilibrada
    [5, 4].forEach(nivel => {
        console.log(`Distribuindo jogadores ${nivel}⭐: ${jogadoresPorNivel[nivel].length}`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Encontrar o time com menos jogadores deste nível
            let melhorTime = 0;
            let menorCount = times[0].jogadores.filter(j => (j.nivel_habilidade || 3) === nivel).length;
            
            for (let i = 1; i < timesCompletos; i++) {
                const count = times[i].jogadores.filter(j => (j.nivel_habilidade || 3) === nivel).length;
                if (count < menorCount && times[i].jogadores.length < jogadoresPorTime) {
                    menorCount = count;
                    melhorTime = i;
                }
            }
            
            if (times[melhorTime].jogadores.length < jogadoresPorTime) {
                const jogador = jogadoresPorNivel[nivel].shift();
                times[melhorTime].jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[melhorTime].nome}`);
            } else {
                break; // Todos os times completos estão cheios
            }
        }
    });
    
    // Depois, distribuir jogadores de nível médio e baixo (3⭐, 2⭐, 1⭐)
    [3, 2, 1].forEach(nivel => {
        console.log(`Distribuindo jogadores ${nivel}⭐: ${jogadoresPorNivel[nivel].length}`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Distribuir sequencialmente, mas priorizando times incompletos
            let colocado = false;
            
            // Primeiro, preencher times incompletos
            for (let i = 0; i < timesCompletos; i++) {
                if (times[i].jogadores.length < jogadoresPorTime) {
                    const jogador = jogadoresPorNivel[nivel].shift();
                    times[i].jogadores.push(jogador);
                    console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome}`);
                    colocado = true;
                    break;
                }
            }
            
            // Se todos os times completos estão cheios, colocar no time incompleto
            if (!colocado && timesCompletos < times.length) {
                for (let i = timesCompletos; i < times.length; i++) {
                    if (jogadoresPorNivel[nivel].length > 0) {
                        const jogador = jogadoresPorNivel[nivel].shift();
                        times[i].jogadores.push(jogador);
                        console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome} (INCOMPLETO)`);
                        break;
                    }
                }
            }
            
            if (!colocado && jogadoresPorNivel[nivel].length > 0) {
                break; // Não conseguiu colocar, sair do loop
            }
        }
    });
    
    console.log('Times após distribuição equilibrada:');
    times.forEach(time => {
        const niveis = time.jogadores.map(j => j.nivel_habilidade || 3);
        const contagem = niveis.reduce((acc, n) => { acc[n] = (acc[n] || 0) + 1; return acc; }, {});
        console.log(`${time.nome}: ${time.jogadores.length} jogadores - ${JSON.stringify(contagem)}`);
    });
}

// Função de sorteio equilibrado COM REGRAS
function aplicarSorteioEquilibrado(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== SORTEIO EQUILIBRADO COM REGRAS ===');
    
    // Criar array com todos os jogadores
    const todosJogadores = [];
    [5, 4, 3, 2, 1].forEach(nivel => {
        jogadoresPorNivel[nivel].forEach(jogador => {
            todosJogadores.push(jogador);
        });
    });
    
    const totalJogadores = todosJogadores.length;
    const timesCompletos = Math.floor(totalJogadores / jogadoresPorTime);
    const jogadoresRestantes = totalJogadores % jogadoresPorTime;
    
    console.log(`Total: ${totalJogadores} jogadores`);
    console.log(`Regra: ${jogadoresPorTime} jogadores por time`);
    console.log(`Formando: ${timesCompletos} times completos + ${jogadoresRestantes > 0 ? '1 incompleto' : '0 incompleto'}`);
    
    // FASE 1: PREENCHER TIMES COMPLETOS (6 jogadores cada)
    let jogadorIndex = 0;
    
    // Preencher times completos usando serpentina
    for (let rodada = 0; rodada < jogadoresPorTime; rodada++) {
        console.log(`\n--- RODADA ${rodada + 1} (preenchendo times completos) ---`);
        
        // Ida: Time 0 → Time (timesCompletos-1)
        for (let t = 0; t < timesCompletos && jogadorIndex < totalJogadores; t++) {
            if (times[t].jogadores.length < jogadoresPorTime) {
                const jogador = todosJogadores[jogadorIndex];
                times[t].jogadores.push(jogador);
                console.log(`${jogadorIndex + 1}º: ${jogador.nome} (${jogador.nivel_habilidade || 3}⭐) → ${times[t].nome} (${times[t].jogadores.length}/${jogadoresPorTime})`);
                jogadorIndex++;
            }
        }
        
        // Volta: Time (timesCompletos-1) → Time 0 (se ainda há jogadores)
        if (rodada < jogadoresPorTime - 1) {
            for (let t = timesCompletos - 1; t >= 0 && jogadorIndex < totalJogadores; t--) {
                if (times[t].jogadores.length < jogadoresPorTime) {
                    const jogador = todosJogadores[jogadorIndex];
                    times[t].jogadores.push(jogador);
                    console.log(`${jogadorIndex + 1}º: ${jogador.nome} (${jogador.nivel_habilidade || 3}⭐) → ${times[t].nome} (${times[t].jogadores.length}/${jogadoresPorTime})`);
                    jogadorIndex++;
                }
            }
            rodada++; // Pular uma rodada pois já fez ida e volta
        }
    }
    
    // FASE 2: COLOCAR JOGADORES RESTANTES NO ÚLTIMO TIME (INCOMPLETO)
    if (jogadorIndex < totalJogadores && times.length > timesCompletos) {
        console.log(`\n--- PREENCHENDO TIME INCOMPLETO ---`);
        const timeIncompleto = times[timesCompletos];
        
        while (jogadorIndex < totalJogadores) {
            const jogador = todosJogadores[jogadorIndex];
            timeIncompleto.jogadores.push(jogador);
            console.log(`${jogadorIndex + 1}º: ${jogador.nome} (${jogador.nivel_habilidade || 3}⭐) → ${timeIncompleto.nome} (INCOMPLETO - ${timeIncompleto.jogadores.length} jogadores)`);
            jogadorIndex++;
        }
    }
    
    // RESULTADO FINAL
    console.log('\n=== TIMES FINAIS ===');
    times.forEach((time, index) => {
        if (time.jogadores.length > 0) {
            const niveis = time.jogadores.map(j => j.nivel_habilidade || 3);
            const soma = niveis.reduce((sum, n) => sum + n, 0);
            const media = (soma / niveis.length).toFixed(1);
            const status = time.jogadores.length === jogadoresPorTime ? 'COMPLETO' : 'INCOMPLETO';
            
            console.log(`${time.nome}: ${time.jogadores.length} jogadores (${status}) - Média: ${media}⭐`);
        }
    });
}

// Distribuir jogadores restantes
function distribuirRestantes(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== DISTRIBUINDO JOGADORES RESTANTES ===');
    let timeAtual = 0;
    
    [5, 4, 3, 2, 1].forEach(nivel => {
        console.log(`Distribuindo jogadores nível ${nivel}: ${jogadoresPorNivel[nivel].length} restantes`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Primeiro tentar preencher times incompletos
            let encontrou = false;
            for (let i = 0; i < times.length; i++) {
                const index = (timeAtual + i) % times.length;
                if (times[index].jogadores.length < jogadoresPorTime) {
                    const jogador = jogadoresPorNivel[nivel].shift();
                    times[index].jogadores.push(jogador);
                    console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[index].nome}`);
                    timeAtual = (index + 1) % times.length;
                    encontrou = true;
                    break;
                }
            }
            
            // Se todos os times estão cheios, distribuir mesmo assim (times ficam com mais jogadores)
            if (!encontrou && jogadoresPorNivel[nivel].length > 0) {
                const index = timeAtual % times.length;
                const jogador = jogadoresPorNivel[nivel].shift();
                times[index].jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[index].nome} (EXTRA)`);
                timeAtual = (timeAtual + 1) % times.length;
            }
        }
    });
    
    console.log('Times finais:');
    times.forEach(time => {
        console.log(`${time.nome}: ${time.jogadores.length} jogadores`);
    });
}

// Exibir resultado do sorteio
function exibirResultado() {
    console.log('=== EXIBINDO RESULTADO ===');
    console.log('Times formados:', timesFormados.map(t => `${t.nome}: ${t.jogadores.length} jogadores`));
    
    // Filtrar apenas times que têm jogadores
    const timesComJogadores = timesFormados.filter(time => time.jogadores.length > 0);
    console.log(`Exibindo ${timesComJogadores.length} times com jogadores`);
    
    teamsContainer.innerHTML = timesComJogadores.map(time => `
        <div class="team-card">
            <div class="team-header">
                <div class="team-name">${time.cores} ${time.nome}</div>
                <div class="team-average">
                    ⭐ ${time.nivelMedio}
                    <small>(${time.jogadores.length} jogadores)</small>
                </div>
            </div>
            <div class="team-players">
                ${time.jogadores.map(jogador => {
                    return `
                        <div class="team-player">
                            <span class="team-player-name">${jogador.nome}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
    
    // Mostrar resultado e botões
    resultadoSorteio.style.display = 'block';
    btnSortear.style.display = 'none';
    btnResort.style.display = 'block';
    
    // Scroll para o resultado
    resultadoSorteio.scrollIntoView({ behavior: 'smooth' });
}

// Confirmar times
async function confirmarTimes() {
    // TELA DE SENHA PARA INICIAR PELADA
    const senhaCorreta = await solicitarSenhaIniciarPelada();
    
    if (!senhaCorreta) {
        return; // Usuário cancelou ou senha incorreta
    }
    
    try {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Iniciando Pelada...</span>
        `;
        
        console.log('=== INICIANDO PELADA ===');
        
        // Verificar se o sorteio foi feito
        if (!timesFormados || timesFormados.length === 0) {
            throw new Error('Faça o sorteio primeiro antes de confirmar os times');
        }
        
        // 1. LIMPAR FILA ATUAL (caso haja conflito de datas)
        console.log('Limpando fila atual...');
        const limparFila = await Database.limparFila();
        if (!limparFila.success) {
            console.warn('Aviso ao limpar fila:', limparFila.error);
        }
        
        // 2. CRIAR FILA ATIVA COM JOGADORES SORTEADOS
        console.log('Criando fila ativa...');
        const filaAtiva = [];
        let posicaoFila = 1;
        
        // Adicionar jogadores dos times na ordem: Time1(1-6), Time2(1-6), Time3(1-6), etc.
        timesFormados.forEach((time, timeIndex) => {
            console.log(`Adicionando ${time.nome} à fila (${time.jogadores.length} jogadores)`);
            
            time.jogadores.forEach((jogador, jogadorIndex) => {
                filaAtiva.push({
                    jogador_id: jogador.id,
                    posicao: posicaoFila,
                    status: 'fila',
                    time_origem: timeIndex + 1,
                    posicao_time: jogadorIndex + 1
                });
                
                console.log(`  ${posicaoFila}º na fila: ${jogador.nome} (${time.nome} - posição ${jogadorIndex + 1})`);
                posicaoFila++;
            });
        });
        
        // 3. ADICIONAR JOGADORES NÃO SELECIONADOS COMO RESERVA
        console.log('Adicionando jogadores não selecionados como reserva...');
        
        // Verificar se as variáveis estão definidas
        console.log('Debug - jogadoresDisponiveis:', jogadoresDisponiveis?.length);
        console.log('Debug - jogadoresSelecionados:', jogadoresSelecionados?.length);
        console.log('Debug - timesFormados:', timesFormados?.length);
        
        if (!jogadoresDisponiveis || !jogadoresSelecionados) {
            throw new Error('Erro: dados dos jogadores não encontrados');
        }
        
        const jogadoresReserva = jogadoresDisponiveis.filter(jogador => 
            !jogadoresSelecionados.includes(jogador.id.toString())
        );
        
        jogadoresReserva.forEach(jogador => {
            filaAtiva.push({
                jogador_id: jogador.id,
                posicao: posicaoFila,
                status: 'reserva',
                time_origem: null,
                posicao_time: null
            });
            
            console.log(`  ${posicaoFila}º na fila: ${jogador.nome} (RESERVA)`);
            posicaoFila++;
        });
        
        // 4. CRIAR SESSÃO DA PELADA PRIMEIRO
        console.log('Criando sessão da pelada...');
        
        // Verificar se os times foram formados corretamente
        if (!timesFormados || timesFormados.length < 2) {
            throw new Error('Erro ao formar times. Tente novamente.');
        }
        
        // Calcular jogadores em campo (primeiros 2 times)
        const time1Jogadores = timesFormados[0]?.jogadores?.length || 0;
        const time2Jogadores = timesFormados[1]?.jogadores?.length || 0;
        const jogadoresEmCampo = time1Jogadores + time2Jogadores;
        const jogadoresNaFila = jogadoresSelecionados.length - jogadoresEmCampo;
        
        const sessaoData = {
            data: new Date().toISOString().split('T')[0], // Apenas a data no formato YYYY-MM-DD
            total_jogadores: jogadoresSelecionados.length,
            status: 'ativa',
            observacoes: `Pelada com ${jogadoresEmCampo} jogadores em campo e ${jogadoresNaFila} na fila`
        };
        
        const resultadoSessao = await Database.criarSessao(sessaoData);
        if (!resultadoSessao.success) {
            throw new Error(resultadoSessao.error);
        }
        
        const sessaoId = resultadoSessao.data[0].id;
        console.log('✅ Sessão criada com ID:', sessaoId);
        
        // 5. SALVAR FILA NO BANCO DE DADOS
        console.log(`Salvando fila completa (${filaAtiva.length} jogadores)...`);
        for (const itemFila of filaAtiva) {
            // Garantir que o status é válido
            let statusValido = itemFila.status;
            if (!['fila', 'reserva'].includes(statusValido)) {
                statusValido = 'fila'; // Padrão seguro
            }
            
            const resultado = await Database.adicionarJogadorFila(
                sessaoId,
                itemFila.jogador_id,
                itemFila.posicao,
                statusValido
            );
            
            if (!resultado.success) {
                console.error(`Erro ao adicionar jogador ${itemFila.jogador_id} à fila:`, resultado.error);
            }
        }
        
        // 6. SUCESSO!
        console.log('✅ PELADA INICIADA COM SUCESSO!');
        mostrarMensagem('🚀 Pelada iniciada com sucesso!\nRedirecionando para a fila!', 'success');
        
        setTimeout(() => {
            window.location.href = 'fila.html';
        }, 2500);
        
    } catch (error) {
        console.error('❌ Erro ao iniciar pelada:', error);
        mostrarMensagem('❌ Erro ao iniciar pelada: ' + error.message, 'error');
        
        // Restaurar botão
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = `
            <span class="emoji">✅</span>
            <span>Confirmar Times</span>
        `;
    }
}

// Mostrar loading
function mostrarLoading(mensagem) {
    teamsContainer.innerHTML = `
        <div class="loading-state">
            <span class="emoji">🎲</span>
            <p>${mensagem}</p>
        </div>
    `;
    resultadoSorteio.style.display = 'block';
}

// Mostrar mensagem
function mostrarMensagem(mensagem, tipo = 'info') {
    const cores = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#2d8f2d'
    };
    
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${cores[tipo] || cores.info};
        color: ${tipo === 'warning' ? '#000' : 'white'};
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    div.textContent = mensagem;
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.remove();
    }, 4000);
}

// Função para solicitar senha antes de iniciar pelada
async function solicitarSenhaIniciarPelada() {
    return new Promise((resolve) => {
        // Criar modal de senha
        const modal = document.createElement('div');
        modal.className = 'modal-senha';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🔐 Confirmação de Segurança</h3>
                        <p>Digite sua senha de usuário para iniciar a pelada</p>
                    </div>
                    
                    <div class="modal-body">
                        <div class="warning-box">
                            <span class="emoji">⚠️</span>
                            <div>
                                <strong>ATENÇÃO:</strong>
                                <p>Isto irá limpar a fila atual e iniciar uma nova pelada.</p>
                            </div>
                        </div>
                        
                        <div class="input-group">
                            <label for="senha-pelada">Sua senha de usuário:</label>
                            <input type="password" id="senha-pelada" placeholder="Digite sua senha" maxlength="20">
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button id="btn-cancelar-senha" class="btn-secondary">
                            <span class="emoji">❌</span>
                            <span>Cancelar</span>
                        </button>
                        <button id="btn-confirmar-senha" class="btn-primary">
                            <span class="emoji">🚀</span>
                            <span>Iniciar Pelada</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar modal ao DOM
        document.body.appendChild(modal);
        
        // Focar no input de senha
        const inputSenha = document.getElementById('senha-pelada');
        const btnConfirmar = document.getElementById('btn-confirmar-senha');
        const btnCancelar = document.getElementById('btn-cancelar-senha');
        
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
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}