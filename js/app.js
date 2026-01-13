// --- APLICAÇÃO PRINCIPAL (DASHBOARD) ---

let DATA = { recs: [], cats: [] };
let QUEUE = [];
let VIEW = 'dashboard';
let CONFIG_APP = {};

window.onload = function() {
    // Verifica Sessão
    const local_conf = localStorage.getItem('ton_config');
    const local_sessao = localStorage.getItem('ton_sessao');
    
    if(!local_conf || !local_sessao) {
        window.location.href = 'index.html';
        return;
    }
    
    CONFIG_APP = JSON.parse(local_conf);
    show_loader(true, 'Sincronizando...');
    load_data();
};

async function load_data() {
    // 1. Carrega Cache Local
    const local_d = localStorage.getItem('ton_data');
    const local_q = localStorage.getItem('ton_queue');
    if(local_d) DATA = JSON.parse(local_d);
    if(local_q) QUEUE = JSON.parse(local_q);

    // 2. Download CSVs (Registros E Categorias)
    try {
        const p1 = fetch(CONFIG_APP.csvs.rec + '&t=' + Date.now()).then(r => r.text());
        const p2 = fetch(CONFIG_APP.csvs.cat + '&t=' + Date.now()).then(r => r.text());
        
        const [txtRec, txtCat] = await Promise.all([p1, p2]);
        
        process_csv_data(txtRec, txtCat);
        
    } catch(e) { 
        console.log('Modo Offline ou Erro Sync:', e); 
    }

    // Seed de segurança (se nunca baixou nada)
    if(DATA.cats.length === 0) {
        ['Trabalhos','Projetos','Estudos','Hobbyes','Esportes','Saúde','Família'].forEach(c => 
            DATA.cats.push({id:'c'+Math.random(), nome:c})
        );
    }

    nav('dashboard');
    show_loader(false);
}

function process_csv_data(txtRec, txtCat) {
    const rowsRec = parse_csv_simple(txtRec);
    const rowsCat = parse_csv_simple(txtCat);
    
    const new_recs = [];
    const new_cats = [];

    // Processa Registros (Busca ID que começa com 'r' seguido de numero)
    rowsRec.forEach(r => {
        // Regex estrito para evitar falsos positivos
        const idIdx = r.findIndex(cell => /^r\d+/.test(cell));
        
        if(idIdx > -1 && r[idIdx+1]) { // Se achou ID e tem Título
            new_recs.push({
                id: r[idIdx],
                titulo: r[idIdx+1],
                data: r[idIdx+2],
                hora: r[idIdx+3],
                valor: r[idIdx+4],
                cat: r[idIdx+5],
                rec: r[idIdx+6],
                status: r[idIdx+7],
                det: r[idIdx+8],
                ts: r[idIdx+9],
                del: r[idIdx+10]
            });
        }
    });

    // Processa Categorias (Busca ID que começa com 'c' seguido de numero)
    rowsCat.forEach(r => {
        const idIdx = r.findIndex(cell => /^c\d+/.test(cell));
        if(idIdx > -1 && r[idIdx+1]) {
            new_cats.push({
                id: r[idIdx],
                nome: r[idIdx+1],
                ts: r[idIdx+2],
                del: r[idIdx+3]
            });
        }
    });

    // Merge: Se baixou dados novos, atualiza.
    if(new_recs.length > 0) DATA.recs = new_recs;
    if(new_cats.length > 0) DATA.cats = new_cats;
    
    persist();
}

function persist() {
    localStorage.setItem('ton_data', JSON.stringify(DATA));
    localStorage.setItem('ton_queue', JSON.stringify(QUEUE));
    render();
}

// --- NAVEGAÇÃO & UI ---
function nav(view) {
    VIEW = view;
    toggle_drawer(false);
    
    const titulos = { 
        dashboard: 'Dashboard', 
        todos: 'Todos', 
        fin: 'Financeiro', 
        org: 'Organizacional', 
        cats: 'Categorias' 
    };
    document.getElementById('page_title').innerText = titulos[view] || 'App';
    
    // Toggle KPI
    document.getElementById('dash_kpi').style.display = (view === 'dashboard') ? 'grid' : 'none';
    
    // Filtros Padrão
    if(view === 'dashboard') document.getElementById('f_period').value = 'hoje';
    
    render();
}

function render() {
    const list = document.getElementById('list_content');
    list.innerHTML = '';

    // Filtra deletados ('true' string ou bool)
    let items = DATA.recs.filter(r => String(r.del) !== 'true');

    // Filtro Contexto
    if(VIEW === 'fin') items = items.filter(r => Number(r.valor) > 0);
    if(VIEW === 'org') items = items.filter(r => !r.valor || Number(r.valor) === 0);

    // Filtros Barra
    const search = document.getElementById('f_search').value.toLowerCase();
    const f_per = document.getElementById('f_period').value;
    const f_st = document.getElementById('f_status').value;
    const f_cat = document.getElementById('f_cat').value;

    if(search) items = items.filter(r => (r.titulo || '').toLowerCase().includes(search));
    if(f_st !== 'todos') items = items.filter(r => r.status === f_st);
    if(f_cat !== 'todos') items = items.filter(r => r.cat === f_cat);

    const rng = get_date_range(f_per);
    if(rng) items = items.filter(r => {
        if(!r.data) return false;
        const d = new Date(r.data + 'T00:00:00');
        return d >= rng.start && d <= rng.end;
    });

    // Ordenação
    if(VIEW === 'dashboard') {
        items.sort((a,b) => (a.hora||'').localeCompare(b.hora||''));
    } else {
        items.sort((a,b) => (b.data||'').localeCompare(a.data||''));
    }

    calc_kpi(items);
    document.getElementById('list_count').innerText = items.length;

    if(items.length === 0) {
        list.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-sec);">Nada encontrado.</div>';
        return;
    }

    items.forEach(r => {
        const valNum = Number(r.valor);
        const is_fin = valNum > 0;
        const valFmt = is_fin ? valNum.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';
        
        // Data BR
        const dataArr = (r.data || '').split('-');
        const dataBr = dataArr.length === 3 ? `${dataArr[2]}/${dataArr[1]}` : '--/--';

        list.innerHTML += `
        <div class="row">
            <div class="r-check ${r.status}" onclick="cycle_status('${r.id}')"></div>
            <div class="r-main" onclick="edit_item('${r.id}')">
                <div class="r-title">${r.titulo}</div>
                <div class="r-meta">
                    <span class="r-cat">${r.cat}</span>
                    <span>${dataBr} • ${r.hora || '--:--'}</span>
                </div>
            </div>
            <div class="r-val" style="${is_fin ? 'color:var(--text-main)' : 'color:var(--text-sec)'}">${valFmt}</div>
        </div>`;
    });
}

function calc_kpi(items) {
    let bal=0, in_=0, out=0, task=0, pend=0, ok=0;
    
    items.forEach(r => {
        const v = Number(r.valor || 0);
        if(v > 0) {
            // Lógica Simplificada: Se categoria for 'Trabalhos', é entrada. Resto é saída.
            // Para maior precisão, pode-se usar sinal negativo no valor input se for saída.
            // Mas seguindo o padrão do Ton:
            if(r.cat === 'Trabalhos' || r.cat === 'Receitas') { 
                in_ += v; 
                bal += v; 
            } else { 
                out += v; 
                bal -= v; 
            }
        } else {
            task++;
            if(r.status === 'pendente') pend++;
            if(r.status === 'concluido') ok++;
        }
    });

    document.getElementById('kpi_bal').innerText = bal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('kpi_bal').style.color = bal >= 0 ? 'var(--fin)' : 'var(--err)';
    document.getElementById('kpi_in').innerText = in_.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('kpi_out').innerText = out.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    
    document.getElementById('kpi_task').innerText = task;
    document.getElementById('kpi_pend').innerText = pend;
    document.getElementById('kpi_ok').innerText = ok;
}

// --- HELPERS DE DATA ---
function get_date_range(p) {
    const h = new Date(); h.setHours(0,0,0,0);
    const e = new Date(); e.setHours(23,59,59,999);
    
    if(p === 'hoje') return {start:h, end:e};
    if(p === 'ontem') { 
        h.setDate(h.getDate()-1); e.setDate(e.getDate()-1); 
        return {start:h, end:e}; 
    }
    if(p === 'mes') { 
        h.setDate(1); 
        e.setMonth(e.getMonth()+1); e.setDate(0); 
        return {start:h, end:e}; 
    }
    if(p === 'tudo') return {start: new Date('2000-01-01'), end: new Date('2100-01-01')};
    
    // Default fallback
    return {start:h, end:e};
}

// --- CRUD ---
function save_item() {
    const id = document.getElementById('e_id').value || 'r' + Date.now();
    const item = {
        id: id,
        titulo: document.getElementById('e_titulo').value,
        data: document.getElementById('e_data').value,
        hora: document.getElementById('e_hora').value,
        valor: document.getElementById('e_valor').value,
        cat: document.getElementById('e_cat').value,
        rec: document.getElementById('e_rec').value,
        status: document.getElementById('e_status').value,
        det: document.getElementById('e_det').value,
        ts: new Date().toISOString(),
        del: 'false'
    };

    if(!item.titulo || !item.data) return alert('Preencha Título e Data');

    // Update Local
    const idx = DATA.recs.findIndex(r => r.id === id);
    if(idx > -1) DATA.recs[idx] = item;
    else DATA.recs.push(item);

    // Add to Queue
    QUEUE.push({ type: 'rec', data: item });
    
    persist();
    modal_close();
}

function cycle_status(id) {
    const r = DATA.recs.find(i => i.id === id);
    if(!r) return;
    
    const map = { pendente:'concluido', concluido:'cancelado', cancelado:'pendente' };
    r.status = map[r.status];
    r.ts = new Date().toISOString();
    
    QUEUE.push({ type: 'rec', data: r });
    persist();
}

function del_item() {
    const id = document.getElementById('e_id').value;
    if(id) {
        const r = DATA.recs.find(i => i.id === id);
        if(r) {
            r.del = 'true';
            r.ts = new Date().toISOString();
            QUEUE.push({ type: 'rec', data: r });
            persist();
            modal_close();
        }
    }
}

// --- SYNC ---
async function sincronizar() {
    if(QUEUE.length === 0) return alert('Tudo sincronizado.');
    
    show_loader(true, `Enviando ${QUEUE.length} itens...`);
    
    // Processa fila
    const failed = [];
    for(let q of QUEUE) {
        try {
            await send_form(CONFIG_APP.forms[q.type], q.data);
        } catch(e) {
            failed.push(q);
        }
    }
    
    QUEUE = failed;
    persist();
    show_loader(false);
    
    if(failed.length > 0) alert(`Erro ao enviar ${failed.length} itens.`);
    else alert('Sincronização concluída!');
}

function logout() {
    localStorage.removeItem('ton_sessao');
    window.location.href = 'index.html';
}

// --- MODAIS & DRAWER ---
function toggle_drawer(force) { 
    const d=document.getElementById('drawer'); const o=document.getElementById('drawer_overlay'); 
    if(force===false || d.classList.contains('open')){ d.classList.remove('open'); o.classList.remove('open'); }
    else { d.classList.add('open'); o.classList.add('open'); } 
}
function toggle_filters(){ document.getElementById('filters_bar').classList.toggle('open'); }

function modal_open(){ 
    document.getElementById('e_id').value=''; 
    document.getElementById('e_data').value=new Date().toISOString().split('T')[0];
    document.getElementById('e_hora').value='';
    document.getElementById('e_titulo').value='';
    document.getElementById('e_valor').value='';
    document.getElementById('e_det').value='';
    populate_cats(); 
    document.getElementById('modal_overlay').classList.add('open'); 
}

function edit_item(id){ 
    const r=DATA.recs.find(i=>i.id===id); 
    document.getElementById('e_id').value=r.id; 
    document.getElementById('e_titulo').value=r.titulo; 
    document.getElementById('e_data').value=r.data; 
    document.getElementById('e_hora').value=r.hora; 
    document.getElementById('e_valor').value=r.valor; 
    populate_cats(); 
    document.getElementById('e_cat').value=r.cat; 
    document.getElementById('e_status').value=r.status; 
    document.getElementById('e_det').value=r.det;
    document.getElementById('modal_overlay').classList.add('open'); 
}

function modal_close(){ document.getElementById('modal_overlay').classList.remove('open'); }

function populate_cats(){ 
    const s = document.getElementById('e_cat'); 
    const f = document.getElementById('f_cat');
    
    // Salva seleção atual do filtro para não resetar
    const currentFilter = f.value;
    
    s.innerHTML = '';
    f.innerHTML = '<option value="todos">Categoria</option>';
    
    // Remove duplicatas e deletados
    const uniqueCats = [...new Set(DATA.cats.filter(c => String(c.del) !== 'true').map(c => c.nome))];
    
    uniqueCats.forEach(name => { 
        s.innerHTML += `<option value="${name}">${name}</option>`; 
        f.innerHTML += `<option value="${name}">${name}</option>`; 
    });
    
    f.value = currentFilter;
}