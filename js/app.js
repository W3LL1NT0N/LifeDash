// --- APLICAÇÃO PRINCIPAL ---

let DATA = { recs: [], cats: [], logs: [] };
let QUEUE = [];
let VIEW = 'dashboard';
let CONFIG_APP = {};
let USER_PREFS = { week_start: 0 }; // 0 Dom, 1 Seg

window.onload = function() {
    try {
        const local_conf = localStorage.getItem('ton_config');
        const local_sessao = localStorage.getItem('ton_sessao');
        const local_prefs = localStorage.getItem('ton_prefs');
        
        // 1. Verificação de Sessão
        if(!local_conf || !local_sessao) { 
            window.location.href = 'index.html'; 
            return; 
        }
        
        CONFIG_APP = JSON.parse(local_conf);
        
        // 2. Verificação de Compatibilidade (Correção da Tela Branca)
        if (!CONFIG_APP.csvs || !CONFIG_APP.csvs.rec) {
            alert("A estrutura do sistema mudou. Por favor, reconfigure as conexões.");
            localStorage.removeItem('ton_config');
            window.location.href = 'index.html';
            return;
        }

        if(local_prefs) USER_PREFS = JSON.parse(local_prefs);
        
        show_loader(true, 'Sincronizando...');
        load_data();

    } catch (err) {
        console.error(err);
        alert("Erro crítico ao iniciar: " + err.message);
        // Opcional: Resetar se estiver muito quebrado
        // localStorage.clear(); window.location.reload();
    }
};

async function load_data() {
    // 1. Local Cache
    const d = localStorage.getItem('ton_data');
    const q = localStorage.getItem('ton_queue');
    
    if(d) {
        try {
            DATA = JSON.parse(d);
            // Garante que logs existe mesmo em cache antigo
            if(!DATA.logs) DATA.logs = [];
            if(!DATA.recs) DATA.recs = [];
            if(!DATA.cats) DATA.cats = [];
        } catch(e) {
            DATA = { recs: [], cats: [], logs: [] };
        }
    }
    
    if(q) QUEUE = JSON.parse(q);

    // 2. Remote CSVs
    try {
        const timestamp = Date.now();
        // Downloads paralelos
        const p1 = fetch(CONFIG_APP.csvs.rec + '&t=' + timestamp).then(r => r.text());
        const p2 = fetch(CONFIG_APP.csvs.cat + '&t=' + timestamp).then(r => r.text());
        const p3 = fetch(CONFIG_APP.csvs.log + '&t=' + timestamp).then(r => r.text());
        
        const [txtRec, txtCat, txtLog] = await Promise.all([p1, p2, p3]);
        process_csvs(txtRec, txtCat, txtLog);
    } catch(e) { 
        console.log('Modo Offline ou Erro CSV:', e); 
    }

    // Seed Cats se vazio
    if(!DATA.cats || DATA.cats.length === 0) {
        DATA.cats = [];
        ['Trabalhos','Projetos','Estudos','Hobbyes','Esportes','Saúde','Família'].forEach(c => 
            DATA.cats.push({id:'c'+Math.random(), nome:c, del:'false'})
        );
    }

    nav('dashboard');
    show_loader(false);
}

function process_csvs(rec, cat, log) {
    const rRec = parse_csv_simple(rec);
    const rCat = parse_csv_simple(cat);
    const rLog = parse_csv_simple(log);
    
    const new_recs = [];
    const new_cats = [];
    const new_logs = [];

    // Recs
    rRec.forEach(r => {
        const i = r.findIndex(c => /^r\d+/.test(c));
        if(i > -1 && r[i+1]) {
            new_recs.push({
                id:r[i], titulo:r[i+1], data:r[i+2], hora:r[i+3], valor:r[i+4], 
                cat:r[i+5], rec:r[i+6], status:r[i+7], det:r[i+8], ts:r[i+9], del:r[i+10]
            });
        }
    });

    // Cats
    rCat.forEach(r => {
        const i = r.findIndex(c => /^[cs]\d+|sys_/.test(c));
        if(i > -1 && r[i+1]) {
            new_cats.push({ id:r[i], nome:r[i+1], ts:r[i+2], del:r[i+3] });
        }
    });

    // Logs
    rLog.forEach(r => {
        // Assume log structure based on content length or tag presence if possible
        if(r.length >= 4) {
            new_logs.push({ ts:r[0], status:r[1], data:r[2], agent:r[3] });
        }
    });

    if(new_recs.length > 0) DATA.recs = new_recs;
    if(new_cats.length > 0) DATA.cats = new_cats;
    if(new_logs.length > 0) DATA.logs = new_logs.reverse();
    
    persist();
}

function persist() {
    localStorage.setItem('ton_data', JSON.stringify(DATA));
    localStorage.setItem('ton_queue', JSON.stringify(QUEUE));
    localStorage.setItem('ton_prefs', JSON.stringify(USER_PREFS));
    render();
}

// --- NAVEGAÇÃO ---
function nav(view) {
    VIEW = view;
    toggle_drawer(false);
    
    const titles = { dashboard:'Dashboard', todos:'Todos', fin:'Financeiro', org:'Organizacional', config:'Configurações', logs:'Logs do Sistema' };
    const elTitle = document.getElementById('page_title');
    if(elTitle) elTitle.innerText = titles[view] || 'App';
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    if(view === 'config') {
        const el = document.getElementById('screen_config');
        if(el) { el.classList.add('active'); render_config(); }
    } else if (view === 'logs') {
        const el = document.getElementById('screen_logs');
        if(el) { el.classList.add('active'); render_logs(); }
    } else {
        const el = document.getElementById('screen_home');
        if(el) {
            el.classList.add('active');
            const kpi = document.getElementById('dash_kpi');
            if(kpi) kpi.style.display = (view === 'dashboard') ? 'grid' : 'none';
            
            // Reset filter on dashboard entry
            if(view === 'dashboard') {
                const fp = document.getElementById('f_period');
                if(fp) fp.value = 'hoje';
            }
            render();
        }
    }
}

// --- RENDER ---
function render() {
    const list = document.getElementById('list_content');
    if(!list) return;
    list.innerHTML = '';
    
    if(!DATA.recs) DATA.recs = [];
    let items = DATA.recs.filter(r => String(r.del) !== 'true');

    // Context Filters
    if(VIEW === 'fin') items = items.filter(r => Number(r.valor) > 0);
    if(VIEW === 'org') items = items.filter(r => !r.valor || Number(r.valor) === 0);

    // Bar Filters
    const elSearch = document.getElementById('f_search');
    const elSt = document.getElementById('f_status');
    const elCat = document.getElementById('f_cat');
    const elPer = document.getElementById('f_period');

    const search = elSearch ? elSearch.value.toLowerCase() : '';
    const f_st = elSt ? elSt.value : 'todos';
    const f_cat = elCat ? elCat.value : 'todos';
    const f_per = elPer ? elPer.value : 'tudo';

    if(search) items = items.filter(r => (r.titulo || '').toLowerCase().includes(search));
    if(f_st !== 'todos') items = items.filter(r => r.status === f_st);
    if(f_cat !== 'todos') items = items.filter(r => r.cat === f_cat);

    const rng = get_date_range(f_per, USER_PREFS.week_start);
    if(rng) items = items.filter(r => {
        if(!r.data) return false;
        // Fix timezone issue by appending time
        const d = new Date(r.data + 'T00:00:00');
        return d >= rng.start && d <= rng.end;
    });

    // Sort
    if(VIEW === 'dashboard') items.sort((a,b) => (a.hora||'').localeCompare(b.hora||''));
    else items.sort((a,b) => (b.data||'').localeCompare(a.data||''));

    calc_kpi(items);
    
    const elCount = document.getElementById('list_count');
    if(elCount) elCount.innerText = items.length;

    if(items.length === 0) { list.innerHTML = '<div style="padding:3rem;text-align:center;color:var(--text-sec)">Nada.</div>'; return; }

    items.forEach(r => {
        const val = Number(r.valor);
        const is_fin = val > 0;
        const vFmt = is_fin ? val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';
        
        const dArr = (r.data||'').split('-');
        const dBr = dArr.length===3 ? `${dArr[2]}/${dArr[1]}` : '--';
        
        const stClass = r.status === 'concluido' ? 'concluido' : '';

        list.innerHTML += `
        <div class="row" onclick="edit_item('${r.id}')">
            <div class="r-check ${stClass}" onclick="event.stopPropagation(); toggle_check('${r.id}')"></div>
            <div class="r-main">
                <div class="r-title">${r.titulo}</div>
                <div class="r-meta">
                    <span class="r-cat">${r.cat}</span>
                    <span>${dBr} • ${r.hora||'--'}</span>
                </div>
            </div>
            <div class="r-val" style="color:${is_fin?'var(--text-main)':'var(--text-sec)'}">${vFmt}</div>
        </div>`;
    });
}

function calc_kpi(items) {
    let bal=0, in_=0, out=0, task=0, pend=0, ok=0;
    items.forEach(r => {
        const v = Number(r.valor||0);
        if(v > 0) {
            if(r.cat === 'Trabalhos' || r.cat === 'Receitas') { in_+=v; bal+=v; }
            else { out+=v; bal-=v; }
        } else {
            task++;
            if(r.status==='pendente') pend++; else ok++;
        }
    });
    
    const setTxt = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    
    setTxt('kpi_bal', bal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
    setTxt('kpi_in', in_.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
    setTxt('kpi_out', out.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
    setTxt('kpi_task', task);
    setTxt('kpi_pend', pend);
    setTxt('kpi_ok', ok);
}

// --- RENDER CONFIG & LOGS ---
function render_config() {
    const list = document.getElementById('conf_cat_list');
    if(!list) return;
    list.innerHTML = '';
    
    const cats = DATA.cats.filter(c => String(c.del) !== 'true' && c.id !== 'sys_token');
    
    cats.forEach(c => {
        list.innerHTML += `
        <div class="cat-item">
            <span>${c.nome}</span>
            <button onclick="del_cat('${c.id}')"><i class="ph ph-trash"></i></button>
        </div>`;
    });

    const rdDom = document.getElementById('ws_dom');
    const rdSeg = document.getElementById('ws_seg');
    if(rdDom) rdDom.checked = (USER_PREFS.week_start === 0);
    if(rdSeg) rdSeg.checked = (USER_PREFS.week_start === 1);
}

function render_logs() {
    const list = document.getElementById('log_list');
    if(!list) return;
    list.innerHTML = '';
    
    // Safety check if logs undefined
    if(!DATA.logs) DATA.logs = [];
    
    DATA.logs.slice(0, 50).forEach(l => {
        const statusText = l.status || '';
        const cls = statusText.includes('SUCESSO') ? 'log-ok' : 'log-fail';
        const dateStr = l.data ? l.data.replace('T',' ').split('.')[0] : '--';
        
        list.innerHTML += `
        <div class="log-row">
            <div class="log-time">${dateStr}</div>
            <div class="log-status ${cls}">${statusText}</div>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${l.agent || '-'}</div>
        </div>`;
    });
}

// --- CRUD ACTIONS ---
function save_item() {
    const titulo = document.getElementById('e_titulo').value;
    const data = document.getElementById('e_data').value;
    if(!titulo || !data) return alert('Título e Data obrigatórios.');

    const id = document.getElementById('e_id').value || 'r' + Date.now();
    const isChecked = document.getElementById('e_status').checked;
    const stVal = isChecked ? 'concluido' : 'pendente';

    const item = {
        id: id,
        titulo: titulo,
        data: data,
        hora: document.getElementById('e_hora').value,
        valor: document.getElementById('e_valor').value,
        cat: document.getElementById('e_cat').value,
        rec: document.getElementById('e_rec').value,
        status: stVal,
        det: document.getElementById('e_det').value,
        ts: new Date().toISOString(),
        del: 'false'
    };

    const idx = DATA.recs.findIndex(r => r.id === id);
    if(idx > -1) DATA.recs[idx] = item;
    else DATA.recs.push(item);

    QUEUE.push({ type: 'rec', data: item });
    persist();
    modal_close();
}

function toggle_check(id) {
    const r = DATA.recs.find(i => i.id === id);
    if(!r) return;
    r.status = (r.status === 'concluido' ? 'pendente' : 'concluido');
    r.ts = new Date().toISOString();
    QUEUE.push({ type: 'rec', data: r });
    persist();
}

function del_item_modal() {
    const id = document.getElementById('e_id').value;
    if(id) {
        const r = DATA.recs.find(i => i.id === id);
        if(r) { r.del = 'true'; r.ts = new Date().toISOString(); QUEUE.push({ type: 'rec', data: r }); }
        persist();
    }
    modal_close();
}

// CONFIG ACTIONS
function add_cat() {
    const el = document.getElementById('new_cat_name');
    const nome = el.value;
    if(!nome) return;
    const item = { id:'c'+Date.now(), nome:nome, ts:new Date().toISOString(), del:'false' };
    DATA.cats.push(item);
    QUEUE.push({ type:'cat', data:item });
    el.value = '';
    persist();
    render_config();
}

function del_cat(id) {
    const c = DATA.cats.find(i => i.id === id);
    if(c) { c.del = 'true'; QUEUE.push({ type:'cat', data:c }); persist(); render_config(); }
}

function save_pref_ws(val) {
    USER_PREFS.week_start = val;
    persist();
}

// SYNC & UTILS
async function sincronizar() {
    if(QUEUE.length === 0) return alert('Tudo em dia.');
    show_loader(true, `Enviando ${QUEUE.length}...`);
    const failed = [];
    for(let q of QUEUE) {
        try { 
            // Check if config exists for type
            if(CONFIG_APP.forms && CONFIG_APP.forms[q.type]) {
                await send_form(CONFIG_APP.forms[q.type], q.data); 
            }
        } 
        catch(e) { failed.push(q); }
    }
    QUEUE = failed; persist(); show_loader(false);
    if(failed.length) alert('Erro ao enviar alguns itens.'); else alert('Sucesso!');
}

function logout() { localStorage.removeItem('ton_sessao'); window.location.href='index.html'; }

function toggle_drawer(f){ const d=document.getElementById('drawer'); const o=document.getElementById('drawer_overlay'); if(f===false||d.classList.contains('open')){d.classList.remove('open');o.classList.remove('open');}else{d.classList.add('open');o.classList.add('open');} }
function toggle_filters(){ document.getElementById('filters_bar').classList.toggle('open'); }

function modal_open() {
    document.getElementById('e_id').value = '';
    document.getElementById('e_data').value = new Date().toISOString().split('T')[0];
    document.getElementById('e_titulo').value = '';
    document.getElementById('e_valor').value = '';
    document.getElementById('e_hora').value = '';
    document.getElementById('e_det').value = '';
    document.getElementById('e_status').checked = false;
    pop_cats_modal();
    document.getElementById('modal_overlay').classList.add('open');
}

function edit_item(id) {
    const r = DATA.recs.find(i => i.id === id);
    if(!r) return;
    document.getElementById('e_id').value = r.id;
    document.getElementById('e_titulo').value = r.titulo;
    document.getElementById('e_data').value = r.data;
    document.getElementById('e_hora').value = r.hora;
    document.getElementById('e_valor').value = r.valor;
    document.getElementById('e_det').value = r.det;
    pop_cats_modal();
    document.getElementById('e_cat').value = r.cat;
    document.getElementById('e_status').checked = (r.status === 'concluido');
    document.getElementById('modal_overlay').classList.add('open');
}

function modal_close() { document.getElementById('modal_overlay').classList.remove('open'); }

function pop_cats_modal() {
    const s = document.getElementById('e_cat');
    const f = document.getElementById('f_cat');
    const cur = f ? f.value : 'todos';
    
    if(s) s.innerHTML = ''; 
    if(f) f.innerHTML = '<option value="todos">Categoria</option>';
    
    const u = [...new Set(DATA.cats.filter(c=>String(c.del)!=='true' && c.id!=='sys_token').map(c=>c.nome))];
    u.forEach(n => {
        if(s) s.innerHTML += `<option>${n}</option>`;
        if(f) f.innerHTML += `<option>${n}</option>`;
    });
    if(f) f.value = cur;
}