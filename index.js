// JavaScript para a página Home

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarStatusPelada();
    await carregarUltimosJogos();
});

// Funções de navegação
function irPara(pagina) {
    window.location.href = pagina;
}

function irParaFila() {
    // Verificar se existe sessão ativa
    const sessaoAtiva = localStorage.getItem('sessaoAtiva');
    if (!sessaoAtiva) {
        alert('❌ Nenhuma sessão ativa! Faça um sorteio primeiro.');
        irPara('sorteio.html');
        return;
    }
    irPara('fila.html');
}

function irParaJogo() {
    // Verificar se existe jogo em andamento
    const jogoAtivo = localStorage.getItem('jogoAtivo');
    if (!jogoAtivo) {
        alert('❌ Nenhum jogo ativo! Inicie um jogo primeiro.');
        return;
    }
    irPara('partida.html');
}

// Carregar status da pelada
async function carregarStatusPelada() {
    try {
        // Buscar sessão ativa
        const { data: sessaoAtiva } = await Database.buscarSessaoAtiva();
        
        if (!sessaoAtiva) {
            document.getElementById('total-jogadores').textContent = '0';
            document.getElementById('jogo-atual').textContent = 'Nenhum';
            document.getElementById('vitorias-consecutivas').textContent = '0';
            return;
        }

        // Buscar jogadores na fila da sessão ativa
        const { data: fila } = await Database.buscarFilaPorSessao(sessaoAtiva.id);
        const jogadoresNaFila = fila ? fila.filter(j => j.status === 'fila').length : 0;
        
        // Buscar jogo em andamento
        const { data: jogoAtivo } = await Database.buscarJogoAtivo(sessaoAtiva.id);
        
        // Calcular vitórias consecutivas máximas
        let vitoriasConsecutivas = 0;
        if (fila && fila.length > 0) {
            vitoriasConsecutivas = Math.max(...fila.map(j => j.vitorias_consecutivas_time || 0));
        }

        // Atualizar interface
        const totalJogadoresEl = document.getElementById('total-jogadores');
        const jogoAtualEl = document.getElementById('jogo-atual');
        
        if (totalJogadoresEl) {
            totalJogadoresEl.textContent = jogadoresNaFila;
        }
        
        if (jogoAtualEl) {
            jogoAtualEl.textContent = jogoAtivo ? 
                `${jogoAtivo.placar_a} x ${jogoAtivo.placar_b}` : 'Nenhum';
        }

        // Habilitar/desabilitar botão de iniciar jogo (se existir)
        const btnIniciarJogo = document.getElementById('btn-iniciar-jogo');
        if (btnIniciarJogo) {
            if (jogadoresNaFila >= 12) {
                btnIniciarJogo.disabled = false;
                btnIniciarJogo.innerHTML = `
                    <span class="emoji">▶️</span>
                    <span>Iniciar Jogo</span>
                `;
            } else {
                btnIniciarJogo.disabled = true;
                btnIniciarJogo.innerHTML = `
                    <span class="emoji">⏸️</span>
                    <span>Precisa de 12+ jogadores</span>
                `;
            }
        }

    } catch (error) {
        console.error('Erro ao carregar status:', error);
    }
}

// Carregar últimos jogos
async function carregarUltimosJogos() {
    try {
        const { data: jogos } = await Database.buscarJogosRecentes(5);
        const listaJogos = document.getElementById('lista-jogos');
        
        if (!jogos || jogos.length === 0) {
            listaJogos.innerHTML = `
                <div class="empty-state">
                    <span class="emoji">😴</span>
                    <p>Nenhum jogo hoje ainda</p>
                </div>
            `;
            return;
        }

        listaJogos.innerHTML = jogos.map(jogo => `
            <div class="game-item">
                <div class="game-info">
                    <div class="game-score">
                        ${jogo.placar_a} x ${jogo.placar_b}
                        ${jogo.time_vencedor ? 
                            (jogo.time_vencedor === 'A' ? ' 🟢' : ' 🔴') : 
                            ' ⚪'
                        }
                    </div>
                    <div class="game-time">
                        ${formatarTempo(jogo.tempo_decorrido)} 
                        ${jogo.status === 'finalizado' ? '✅' : '⏸️'}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar jogos:', error);
    }
}

// Iniciar novo jogo
async function iniciarJogo() {
    try {
        const { data: sessaoAtiva } = await Database.buscarSessaoAtiva();
        if (!sessaoAtiva) {
            alert('❌ Nenhuma sessão ativa!');
            return;
        }

        // Verificar se já existe jogo ativo
        const { data: jogoAtivo } = await Database.buscarJogoAtivo(sessaoAtiva.id);
        if (jogoAtivo) {
            if (confirm('🎮 Já existe um jogo ativo. Continuar?')) {
                localStorage.setItem('jogoAtivo', jogoAtivo.id);
                irPara('partida.html');
            }
            return;
        }

        // Buscar primeiros 12 da fila
        const { data: fila } = await Database.buscarFilaPorSessao(sessaoAtiva.id);
        const jogadoresAtivos = fila.filter(j => j.status === 'fila')
                                   .sort((a, b) => a.posicao_fila - b.posicao_fila);

        if (jogadoresAtivos.length < 12) {
            alert(`❌ Precisa de pelo menos 12 jogadores. Atual: ${jogadoresAtivos.length}`);
            return;
        }

        // Separar times
        const timeA = jogadoresAtivos.slice(0, 6).map(j => j.jogador_id);
        const timeB = jogadoresAtivos.slice(6, 12).map(j => j.jogador_id);

        // Criar novo jogo
        const novoJogo = {
            sessao_id: sessaoAtiva.id,
            time_a: timeA,
            time_b: timeB,
            status: 'em_andamento'
        };

        const { data: jogo } = await Database.criarJogo(novoJogo);
        
        if (jogo) {
            localStorage.setItem('jogoAtivo', jogo[0].id);
            irPara('partida.html');
        }

    } catch (error) {
        console.error('Erro ao iniciar jogo:', error);
        alert('❌ Erro ao iniciar jogo!');
    }
}

// Utilitários
function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Atualizar página automaticamente
setInterval(carregarStatusPelada, 30000); // A cada 30 segundos