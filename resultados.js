// Elementos DOM
const btnHoje = document.getElementById('btn-hoje');
const selectDatas = document.getElementById('select-datas');
const totalPartidas = document.getElementById('total-partidas');
const totalGols = document.getElementById('total-gols');
const totalJogadores = document.getElementById('total-jogadores');
const btnPartidas = document.getElementById('btn-partidas');
const btnGols = document.getElementById('btn-gols');
const btnJogadores = document.getElementById('btn-jogadores');
const btnEstatisticas = document.getElementById('btn-estatisticas');
const loading = document.getElementById('loading');
const partidasSection = document.getElementById('partidas-section');
const emptyState = document.getElementById('empty-state');

// Estado da aplicação
let todasPartidas = [];
let jogadores = [];
let datasDisponiveis = [];
let partidasFiltradas = []; // Para os modais

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarDados();
    configurarEventos();
    aplicarFiltro('hoje');
});

// Configurar eventos
function configurarEventos() {
    // Botão hoje
    btnHoje.addEventListener('click', () => {
        aplicarFiltro('hoje');
        selectDatas.value = '';
        btnHoje.classList.add('active');
    });
    
    // Seletor de datas
    selectDatas.addEventListener('change', (e) => {
        if (e.target.value) {
            aplicarFiltro('data', e.target.value);
            btnHoje.classList.remove('active');
        } else {
            aplicarFiltro('hoje');
            btnHoje.classList.add('active');
        }
    });
    
    // Botão de estatísticas
    btnEstatisticas.addEventListener('click', () => {
        window.location.href = 'estatisticas.html';
    });
    
    // Botão de partidas
    btnPartidas.addEventListener('click', () => {
        window.location.reload();
    });
    
    // Botão de jogadores
    btnJogadores.addEventListener('click', () => {
        mostrarModalJogadores();
    });
    
    // Botão de gols
    btnGols.addEventListener('click', () => {
        mostrarModalGols();
    });
}

// Preencher datas disponíveis
function preencherDatasDisponiveis() {
    console.log('Preenchendo datas disponíveis. Total de partidas:', todasPartidas.length);
    
    // Obter datas únicas das partidas
    const datasUnicas = [...new Set(todasPartidas.map(partida => {
        const data = new Date(partida.created_at);
        return data.toISOString().split('T')[0];
    }))].sort().reverse(); // Mais recentes primeira

    console.log('Datas únicas encontradas:', datasUnicas);

    // Limpar select
    selectDatas.innerHTML = '<option value="">Selecione uma data</option>';
    
    // Adicionar opções de datas
    datasUnicas.forEach(data => {
        const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        const option = document.createElement('option');
        option.value = data;
        option.textContent = dataFormatada;
        selectDatas.appendChild(option);
    });
    
    datasDisponiveis = datasUnicas;
    console.log('Select preenchido com', datasUnicas.length, 'datas');
}

// Carregar dados do banco
async function carregarDados() {
    try {
        mostrarLoading(true);
        
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
            if (!client) {
                throw new Error('Não foi possível inicializar o Supabase');
            }
        }
        
        // Carregar todas as partidas primeiro para debug
        const { data: todasPartidasBanco, error: todasPartidasError } = await client
            .from('jogos')
            .select('*')
            .order('created_at', { ascending: false });

        if (todasPartidasError) {
            console.error('Erro ao carregar todas as partidas:', todasPartidasError);
            throw todasPartidasError;
        }

        console.log('Todas as partidas do banco:', todasPartidasBanco);
        console.log('Status das partidas:', todasPartidasBanco?.map(p => ({ id: p.id, status: p.status, data: p.created_at })));

        // Filtrar apenas as finalizadas
        const partidasFinalizadas = todasPartidasBanco?.filter(p => p.status === 'finalizado') || [];
        
        console.log('Partidas finalizadas encontradas:', partidasFinalizadas);

        // Carregar jogadores
        const { data: jogadoresData, error: jogadoresError } = await client
            .from('jogadores')
            .select('*');

        if (jogadoresError) throw jogadoresError;

        todasPartidas = partidasFinalizadas;
        jogadores = jogadoresData || [];

        console.log('Dados finais carregados:', { 
            partidas: todasPartidas.length, 
            jogadores: jogadores.length,
            primeiraPartida: todasPartidas[0]
        });

        // Preencher datas disponíveis após carregar os dados
        preencherDatasDisponiveis();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarErro('Erro ao carregar dados das partidas');
    } finally {
        mostrarLoading(false);
    }
}

// Aplicar filtro
function aplicarFiltro(tipo, dataEspecificaValue = null) {
    let partidasFiltradas = [];
    
    if (tipo === 'hoje') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date();
        fimHoje.setHours(23, 59, 59, 999);
        
        partidasFiltradas = todasPartidas.filter(partida => {
            const dataPartida = new Date(partida.created_at);
            return dataPartida >= hoje && dataPartida <= fimHoje;
        });
    } else if (tipo === 'data' && dataEspecificaValue) {
        const dataFiltro = new Date(dataEspecificaValue + 'T00:00:00');
        const fimDataFiltro = new Date(dataEspecificaValue + 'T23:59:59');
        
        partidasFiltradas = todasPartidas.filter(partida => {
            const dataPartida = new Date(partida.created_at);
            return dataPartida >= dataFiltro && dataPartida <= fimDataFiltro;
        });
    }
    
    renderizarResultados(partidasFiltradas);
}

// Renderizar resultados
async function renderizarResultados(partidas) {
    try {
        // Salvar partidas filtradas para os modais
        partidasFiltradas = partidas;
        
        // Atualizar resumo
        await atualizarResumo(partidas);
        
        // Verificar se há partidas
        if (partidas.length === 0) {
            partidasSection.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Carregar gols para todas as partidas
        const partidasComGols = await Promise.all(
            partidas.map(async (partida) => {
                const gols = await carregarGolsPartida(partida.id);
                return { ...partida, gols };
            })
        );
        
        // Renderizar partidas
        partidasSection.innerHTML = partidasComGols.map(partida => 
            criarCardPartida(partida)
        ).join('');
        
    } catch (error) {
        console.error('Erro ao renderizar resultados:', error);
        mostrarErro('Erro ao exibir resultados');
    }
}

// Atualizar resumo
async function atualizarResumo(partidas) {
    const numPartidas = partidas.length;
    let numGols = 0;
    const jogadoresUnicos = new Set();
    
    for (const partida of partidas) {
        // Contar gols
        const gols = await carregarGolsPartida(partida.id);
        numGols += gols.length;
        
        // Contar jogadores únicos
        if (partida.time_a) {
            partida.time_a.forEach(id => jogadoresUnicos.add(id));
        }
        if (partida.time_b) {
            partida.time_b.forEach(id => jogadoresUnicos.add(id));
        }
    }
    
    // Atualizar interface
    totalPartidas.textContent = numPartidas;
    totalGols.textContent = numGols;
    totalJogadores.textContent = jogadoresUnicos.size;
}

// Carregar gols de uma partida
async function carregarGolsPartida(partidaId) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        const { data: gols, error } = await client
            .from('gols')
            .select('*')
            .eq('jogo_id', partidaId);

        if (error) throw error;
        return gols || [];
    } catch (error) {
        console.error('Erro ao carregar gols:', error);
        return [];
    }
}

// Criar card de partida
function criarCardPartida(partida) {
    const dataPartida = new Date(partida.created_at);
    const dataFormatada = dataPartida.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const horaFormatada = dataPartida.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Calcular duração
    let duracaoTexto = 'N/A';
    if (partida.data_fim) {
        const inicio = new Date(partida.created_at);
        const fim = new Date(partida.data_fim);
        const diferencaMs = fim - inicio;
        const minutos = Math.floor(diferencaMs / 60000);
        const segundos = Math.floor((diferencaMs % 60000) / 1000);
        if (minutos > 0 || segundos > 0) {
            duracaoTexto = `⏱️ ${minutos}min ${segundos}s`;
        }
    }

    // Contar gols por time
    const golsTimeA = partida.gols?.filter(g => g.time === 'A').length || 0;
    const golsTimeB = partida.gols?.filter(g => g.time === 'B').length || 0;

    // Determinar vencedor
    let classVencedorA = '', classVencedorB = '';
    if (golsTimeA > golsTimeB) {
        classVencedorA = 'vencedor';
    } else if (golsTimeB > golsTimeA) {
        classVencedorB = 'vencedor';
    }

    // Estatísticas da partida
    const totalGolsPartida = partida.gols?.length || 0;
    const totalJogadoresPartida = (partida.time_a?.length || 0) + (partida.time_b?.length || 0);
    const mediaGolsPartida = totalJogadoresPartida > 0 ? (totalGolsPartida / totalJogadoresPartida).toFixed(1) : '0.0';

    return `
        <div class="partida-card">
            <!-- Header -->
            <div class="partida-header">
                <div class="partida-info">
                    <div class="partida-data">${dataFormatada}</div>
                    <div class="partida-hora">${horaFormatada}</div>
                </div>
                <div class="partida-duracao">${duracaoTexto}</div>
            </div>

            <!-- Placar -->
            <div class="partida-placar">
                <div class="placar">
                    <div class="time ${classVencedorA}">
                        <div class="time-gols">${golsTimeA}</div>
                    </div>
                    <div class="vs">×</div>
                    <div class="time ${classVencedorB}">
                        <div class="time-gols">${golsTimeB}</div>
                    </div>
                </div>
            </div>

            ${renderizarJogadoresPartida(partida)}
        </div>
    `;
}

// Renderizar jogadores da partida
function renderizarJogadoresPartida(partida) {
    const timeA = partida.time_a || [];
    const timeB = partida.time_b || [];
    const gols = partida.gols || [];

    if (timeA.length === 0 && timeB.length === 0) {
        return '';
    }

    // Criar map de jogadores que fizeram gols por time
    const golsPorJogador = {};
    gols.forEach(gol => {
        if (!golsPorJogador[gol.jogador_id]) {
            golsPorJogador[gol.jogador_id] = 0;
        }
        golsPorJogador[gol.jogador_id]++;
    });

    return `
        <div class="partida-jogadores">
            <div class="jogadores-grid">
                <div class="time-jogadores">
                    <div class="jogadores-lista">
                        ${timeA.map(jogadorId => {
                            const nomeJogador = obterNomeJogador(jogadorId);
                            const numGols = golsPorJogador[jogadorId] || 0;
                            const bolasGol = numGols > 0 ? '⚽'.repeat(numGols) + ' ' : '';
                            return `<div class="jogador-nome">${bolasGol}${nomeJogador}</div>`;
                        }).join('')}
                    </div>
                </div>
                <div class="time-jogadores">
                    <div class="jogadores-lista">
                        ${timeB.map(jogadorId => {
                            const nomeJogador = obterNomeJogador(jogadorId);
                            const numGols = golsPorJogador[jogadorId] || 0;
                            const bolasGol = numGols > 0 ? '⚽'.repeat(numGols) + ' ' : '';
                            return `<div class="jogador-nome">${bolasGol}${nomeJogador}</div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Obter nome do jogador por ID (número antigo)
function obterNomeJogador(jogadorId) {
    const jogador = jogadores.find(j => j.id === jogadorId);
    return jogador ? jogador.nome : `Jogador ${jogadorId}`;
}

// Obter nome do jogador por UUID
function obterNomeJogadorPorId(jogadorUuid) {
    const jogador = jogadores.find(j => j.id === jogadorUuid);
    return jogador ? jogador.nome : `Jogador não encontrado`;
}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
    loading.style.display = mostrar ? 'block' : 'none';
    partidasSection.style.display = mostrar ? 'none' : 'block';
}

// Mostrar erro
function mostrarErro(mensagem) {
    partidasSection.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Erro</h3>
            <p>${mensagem}</p>
        </div>
    `;
}

// Funções dos modais
function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function mostrarModalJogadores() {
    const modal = document.getElementById('modal-jogadores');
    const lista = document.getElementById('lista-jogadores');
    
    // Contar partidas, vitórias e gols por jogador
    const jogadoresStats = {};
    
    for (const partida of partidasFiltradas) {
        const jogadoresPartida = [...(partida.time_a || []), ...(partida.time_b || [])];
        
        // Contar gols para determinar vencedor E gols individuais
        const gols = await carregarGolsPartida(partida.id);
        const golsTimeA = gols.filter(g => g.time === 'A').length;
        const golsTimeB = gols.filter(g => g.time === 'B').length;
        
        for (const jogadorId of jogadoresPartida) {
            if (!jogadoresStats[jogadorId]) {
                jogadoresStats[jogadorId] = { partidas: 0, vitorias: 0, gols: 0 };
            }
            jogadoresStats[jogadorId].partidas++;
            
            // Verificar se jogador estava no time vencedor
            const jogadorNoTimeA = partida.time_a?.includes(jogadorId);
            const jogadorNoTimeB = partida.time_b?.includes(jogadorId);
            
            if ((jogadorNoTimeA && golsTimeA > golsTimeB) || 
                (jogadorNoTimeB && golsTimeB > golsTimeA)) {
                jogadoresStats[jogadorId].vitorias++;
            }
            
            // Contar gols do jogador nesta partida
            const golsJogador = gols.filter(g => g.jogador_id === jogadorId).length;
            jogadoresStats[jogadorId].gols += golsJogador;
        }
    }
    
    // Converter para array e ordenar
    const jogadoresArray = Object.entries(jogadoresStats)
        .map(([id, stats]) => {
            const nomeJogador = obterNomeJogadorPorId(id);
            return {
                nome: nomeJogador,
                partidas: stats.partidas,
                vitorias: stats.vitorias,
                gols: stats.gols
            };
        })
        .sort((a, b) => b.partidas - a.partidas);
    
    // Gerar HTML
    let html = '';
    if (jogadoresArray.length === 0) {
        html = '<div class="jogador-sem-gol">Nenhum jogador encontrado no período selecionado.</div>';
    } else {
        jogadoresArray.forEach(jogador => {
            html += `
                <div class="jogador-item">
                    <span class="jogador-nome">${jogador.nome}</span>
                    <span class="jogador-stats">${jogador.partidas} partida${jogador.partidas !== 1 ? 's' : ''} • ${jogador.vitorias} vitória${jogador.vitorias !== 1 ? 's' : ''} • ${jogador.gols} gol${jogador.gols !== 1 ? 's' : ''}</span>
                </div>
            `;
        });
    }
    
    lista.innerHTML = html;
    modal.style.display = 'flex';
}

async function mostrarModalGols() {
    const modal = document.getElementById('modal-gols');
    const lista = document.getElementById('lista-gols');
    
    // Coletar todos os gols do período
    const golsPorJogador = {};
    const todosJogadores = new Set();
    
    for (const partida of partidasFiltradas) {
        // Adicionar todos os jogadores da partida
        [...(partida.time_a || []), ...(partida.time_b || [])].forEach(id => {
            todosJogadores.add(id);
            if (!golsPorJogador[id]) {
                golsPorJogador[id] = 0;
            }
        });
        
        // Contar gols
        const gols = await carregarGolsPartida(partida.id);
        gols.forEach(gol => {
            if (golsPorJogador[gol.jogador_id] !== undefined) {
                golsPorJogador[gol.jogador_id]++;
            } else {
                golsPorJogador[gol.jogador_id] = 1;
                todosJogadores.add(gol.jogador_id);
            }
        });
    }
    
    // Separar jogadores com e sem gols
    const comGols = [];
    const semGols = [];
    
    Array.from(todosJogadores).forEach(jogadorId => {
        const nomeJogador = obterNomeJogadorPorId(jogadorId);
        const numGols = golsPorJogador[jogadorId] || 0;
        
        if (numGols > 0) {
            comGols.push({ nome: nomeJogador, gols: numGols });
        } else {
            semGols.push({ nome: nomeJogador });
        }
    });
    
    // Ordenar
    comGols.sort((a, b) => b.gols - a.gols);
    semGols.sort((a, b) => a.nome.localeCompare(b.nome));
    
    // Gerar HTML
    let html = '';
    
    if (comGols.length > 0) {
        html += '<div class="gols-section"><h4>⚽ Artilheiros</h4>';
        comGols.forEach(jogador => {
            html += `
                <div class="gol-item">
                    <span class="jogador-nome">${jogador.nome}</span>
                    <span class="jogador-stats">${jogador.gols} gol${jogador.gols !== 1 ? 's' : ''}</span>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (semGols.length > 0) {
        html += '<div class="gols-section"><h4>👥 Sem Gols</h4>';
        semGols.forEach(jogador => {
            html += `<div class="jogador-sem-gol">${jogador.nome}</div>`;
        });
        html += '</div>';
    }
    
    if (comGols.length === 0 && semGols.length === 0) {
        html = '<div class="jogador-sem-gol">Nenhum jogador encontrado no período selecionado.</div>';
    }
    
    lista.innerHTML = html;
    modal.style.display = 'flex';
}

// ================================
// FUNÇÃO ADMINISTRATIVA - APAGAR DADOS DO DIA
// ================================

// Elementos do modal de apagar dados
const btnApagarDia = document.getElementById('btn-apagar-dia');
const modalApagarDia = document.getElementById('modal-apagar-dia');
const dataApagar = document.getElementById('data-apagar');
const confirmacaoTexto = document.getElementById('confirmacao-texto');
const btnCancelarApagar = document.getElementById('cancelar-apagar');
const btnConfirmarApagar = document.getElementById('confirmar-apagar');

// Event listeners
if (btnApagarDia) {
    btnApagarDia.addEventListener('click', mostrarModalApagarDia);
}

if (btnCancelarApagar) {
    btnCancelarApagar.addEventListener('click', fecharModalApagarDia);
}

if (btnConfirmarApagar) {
    btnConfirmarApagar.addEventListener('click', executarApagarDados);
}

// Buscar datas disponíveis no banco
async function buscarDatasDisponiveis() {
    try {
        const result = await Database.buscarTodos('sessoes', {
            orderBy: 'data_sessao',
            orderDirection: 'desc'
        });
        
        if (result.success && result.data) {
            // Extrair datas únicas
            const datas = [...new Set(result.data.map(sessao => sessao.data_sessao))];
            return datas;
        }
        
        return [];
    } catch (error) {
        console.error('Erro ao buscar datas:', error);
        return [];
    }
}

// Popular o select de datas
async function popularSelectDatas() {
    const selectData = document.getElementById('data-apagar');
    
    if (!selectData) return;
    
    // Limpar opções existentes
    selectData.innerHTML = '<option value="">Carregando datas...</option>';
    selectData.disabled = true;
    
    try {
        const datas = await buscarDatasDisponiveis();
        
        // Limpar novamente
        selectData.innerHTML = '';
        
        if (datas.length === 0) {
            selectData.innerHTML = '<option value="">Nenhuma data encontrada</option>';
            selectData.disabled = true;
            return;
        }
        
        // Adicionar opção padrão
        selectData.innerHTML = '<option value="">Selecione uma data...</option>';
        
        // Adicionar opções de datas
        datas.forEach(data => {
            const option = document.createElement('option');
            option.value = data;
            
            // Formatar data para exibição
            const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
            option.textContent = dataFormatada;
            
            selectData.appendChild(option);
        });
        
        selectData.disabled = false;
        
    } catch (error) {
        console.error('Erro ao popular select de datas:', error);
        selectData.innerHTML = '<option value="">Erro ao carregar datas</option>';
        selectData.disabled = true;
    }
}

if (confirmacaoTexto) {
    confirmacaoTexto.addEventListener('input', validarConfirmacao);
}

// Função para mostrar modal
function mostrarModalApagarDia() {
    // Popular as datas disponíveis
    popularSelectDatas();
    
    // Limpar confirmação
    confirmacaoTexto.value = '';
    btnConfirmarApagar.disabled = true;
    
    // Mostrar modal
    modalApagarDia.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Função para fechar modal
function fecharModalApagarDia() {
    modalApagarDia.style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpar campos
    dataApagar.value = '';
    dataApagar.innerHTML = '<option value="">Selecione uma data...</option>';
    confirmacaoTexto.value = '';
    btnConfirmarApagar.disabled = true;
}

// Validar confirmação
function validarConfirmacao() {
    const textoDigitado = confirmacaoTexto.value.trim().toUpperCase();
    const textoCorreto = 'APAGAR';
    
    if (textoDigitado === textoCorreto) {
        btnConfirmarApagar.disabled = false;
        btnConfirmarApagar.style.background = '#dc3545';
    } else {
        btnConfirmarApagar.disabled = true;
        btnConfirmarApagar.style.background = '#ccc';
    }
}

// Executar exclusão dos dados
async function executarApagarDados() {
    const dataSelecionada = dataApagar.value;
    
    if (!dataSelecionada) {
        alert('⚠️ Selecione uma data válida!');
        return;
    }
    
    if (confirmacaoTexto.value.trim().toUpperCase() !== 'APAGAR') {
        alert('⚠️ Digite "APAGAR" para confirmar!');
        return;
    }
    
    try {
        // Mostrar loading
        btnConfirmarApagar.innerHTML = '<span class="emoji">⏳</span><span>Apagando...</span>';
        btnConfirmarApagar.disabled = true;
        
        console.log(`🗑️ Iniciando exclusão de dados do dia: ${dataSelecionada}`);
        
        // Chamar função do banco para apagar dados do dia
        const resultado = await Database.apagarDadosDoDia(dataSelecionada);
        
        if (resultado.success) {
            console.log('✅ Dados apagados com sucesso:', resultado);
            
            // Fechar modal
            fecharModalApagarDia();
            
            // Mostrar confirmação
            alert(`✅ Dados de ${formatarData(dataSelecionada)} foram apagados com sucesso!\n\n📊 Dados removidos:\n• ${resultado.partidasApagadas || 0} partidas\n• ${resultado.golsApagados || 0} gols\n• ${resultado.estatisticasApagadas || 0} registros de estatísticas`);
            
            // Recarregar dados da tela
            await carregarDados();
            
        } else {
            throw new Error(resultado.error || 'Erro desconhecido');
        }
        
    } catch (error) {
        console.error('❌ Erro ao apagar dados:', error);
        alert(`❌ Erro ao apagar dados: ${error.message}`);
        
        // Restaurar botão
        btnConfirmarApagar.innerHTML = '<span class="emoji">🗑️</span><span>Apagar Dados</span>';
        btnConfirmarApagar.disabled = false;
    }
}

// Função auxiliar para formatar data
function formatarData(dataString) {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
}