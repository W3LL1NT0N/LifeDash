// --- APLICAÇÃO PRINCIPAL (DASHBOARD) ---

let DATA = { recs: [], cats: [] };
let QUEUE = [];
let VIEW = 'dashboard';
let CONFIG_APP = {};

window.onload = function() {
    // Check Auth
    const local_conf = localStorage.getItem('ton_config');
    const local_sessao = localStorage.getItem('ton_sessao');
    
    if(!local_conf || !local_sessao) {
        window.location.href = 'index.html';
        return;
    }
    
    CONFIG_APP = JSON.parse(local_conf);
    show_loader(true, 'Carregando dados...');
    load_data();
};

async function load_data() {
    // 1. Load Local
    const local_d = localStorage.getItem('ton_data');
    const local_q = localStorage.getItem('ton_queue');
    if(local_d) DATA = JSON.parse(local_d);
    if(local_q) QUEUE = JSON.parse(local_q);

    // 2. Load CSV Remoto (Background update)
    try {
        const res = await fetch(CONFIG_APP.csvs.rec + '&t=' + Date.now());
        const txt = await res.text();
        parse_main_csv(txt);
    } catch(e) { console.log('Offline'); }

    // Seed Cats
    if(DATA.cats.length===0) ['Trabalhos','Projetos','Estudos','Hobbyes','Esportes','Saúde','Família'].forEach(c=>DATA.cats.push({id:'c'+Math.random(),nome:c}));

    nav('dashboard');
    show_loader(false);
}

function parse_main_csv(txt) {
    const rows = parse_csv_simple(txt);
    const new_recs = [];
    rows.forEach(r => {
        const id = r.find(c => c.startsWith('r'));
        if(id) {
            const i = r.indexOf(id);
            // Tenta mapear colunas relativas
            if(r[i+1]) new_recs.push({
                id:r[i], titulo:r[i+1], data:r[i+2], hora:r[i+3], valor:r[i+4], 
                cat:r[i+5], rec:r[i+6], status:r[i+7], det:r[i+8], ts:r[i+9], del:r[i+10]
            });
        }
    });
    if(new_recs.length > 0) DATA.recs = new_recs;
    persist();
}

function persist() {
    localStorage.setItem('ton_data', JSON.stringify(DATA));
    localStorage.setItem('ton_queue', JSON.stringify(QUEUE));
    render();
}

// --- UI & RENDER ---
function nav(view) {
    VIEW = view; toggle_drawer(false);
    const t = { dashboard:'Dashboard', todos:'Todos', fin:'Financeiro', org:'Organizacional', cats:'Categorias' };
    document.getElementById('page_title').innerText = t[view] || 'App';
    document.getElementById('dash_kpi').style.display = (view === 'dashboard') ? 'grid' : 'none';
    
    // Default Filters
    if(view === 'dashboard') document.getElementById('f_period').value = 'hoje';
    
    render();
}

function render() {
    const list = document.getElementById('list_content'); list.innerHTML = '';
    let items = DATA.recs.filter(r => r.del !== 'true');
    
    // Context Filters
    if(VIEW === 'fin') items = items.filter(r => Number(r.valor) > 0);
    if(VIEW === 'org') items = items.filter(r => !r.valor || Number(r.valor)===0);
    
    // Bar Filters
    const search = document.getElementById('f_search').value.toLowerCase();
    const f_per = document.getElementById('f_period').value;
    const f_st = document.getElementById('f_status').value;
    const f_cat = document.getElementById('f_cat').value;

    if(search) items = items.filter(r => (r.titulo||'').toLowerCase().includes(search));
    if(f_st !== 'todos') items = items.filter(r => r.status === f_st);
    if(f_cat !== 'todos') items = items.filter(r => r.cat === f_cat);
    
    const rng = get_date_range(f_per);
    if(rng) items = items.filter(r => {
        const d = new Date(r.data + 'T00:00:00');
        return d >= rng.start && d <= rng.end;
    });

    calc_kpi(items);
    document.getElementById('list_count').innerText = items.length;

    if(items.length===0) { list.innerHTML='<div style="padding:2rem;text-align:center;color:var(--text-sec)">Nada aqui.</div>'; return; }

    items.forEach(r => {
        const is_fin = Number(r.valor) > 0;
        const val = is_fin ? Number(r.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '';
        const date = (r.data||'').split('-').reverse().join('/');
        list.innerHTML += `
        <div class="row">
            <div class="r-check ${r.status}" onclick="cycle_status('${r.id}')"></div>
            <div class="r-main" onclick="edit_item('${r.id}')">
                <div class="r-title">${r.titulo}</div>
                <div class="r-meta"><span class="r-cat">${r.cat}</span><span>${date}</span></div>
            </div>
            <div class="r-val">${val}</div>
        </div>`;
    });
}

function calc_kpi(items) {
    let bal=0, in_=0, out=0, task=0, pend=0, ok=0;
    items.forEach(r => {
        const v = Number(r.valor||0);
        if(v>0) { if(r.cat==='Trabalhos') { in_+=v; bal+=v; } else { out+=v; bal-=v; } } 
        else { task++; if(r.status==='pendente') pend++; if(r.status==='concluido') ok++; }
    });
    document.getElementById('kpi_bal').innerText = bal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('kpi_in').innerText = in_.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('kpi_out').innerText = out.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('kpi_task').innerText = task; document.getElementById('kpi_pend').innerText = pend; document.getElementById('kpi_ok').innerText = ok;
}

function get_date_range(p) {
    const h = new Date(); h.setHours(0,0,0,0); const e = new Date(); e.setHours(23,59,59,999);
    if(p==='hoje') return {start:h, end:e};
    if(p==='ontem') { h.setDate(h.getDate()-1); e.setDate(e.getDate()-1); return {start:h, end:e}; }
    if(p==='mes') { h.setDate(1); e.setMonth(e.getMonth()+1); e.setDate(0); return {start:h, end:e}; }
    if(p==='tudo') return null;
    return null;
}

// --- CRUD ---
function save_item(){
    const id=document.getElementById('e_id').value||'r'+Date.now();
    const item={id, titulo:document.getElementById('e_titulo').value, data:document.getElementById('e_data').value, hora:document.getElementById('e_hora').value, valor:document.getElementById('e_valor').value, cat:document.getElementById('e_cat').value, status:document.getElementById('e_status').value, del:'false'};
    const idx=DATA.recs.findIndex(r=>r.id===id); if(idx>-1)DATA.recs[idx]=item; else DATA.recs.push(item);
    QUEUE.push({type:'rec',data:item}); persist(); modal_close();
}
function cycle_status(id) {
    const r=DATA.recs.find(i=>i.id===id); const map={pendente:'concluido',concluido:'cancelado',cancelado:'pendente'};
    r.status=map[r.status]; QUEUE.push({type:'rec',data:r}); persist();
}
function del_item(){ const id=document.getElementById('e_id').value; if(id){ const r=DATA.recs.find(i=>i.id===id); r.del='true'; QUEUE.push({type:'rec',data:r}); persist(); modal_close(); } }

async function sincronizar(){ 
    alert('Enviando '+QUEUE.length+' itens...'); 
    for(let q of QUEUE){ await send_form(CONFIG_APP.forms[q.type], q.data); } 
    QUEUE=[]; persist(); alert('OK'); 
}

function logout() { localStorage.removeItem('ton_sessao'); window.location.href='index.html'; }

// --- UI HELPERS ---
function toggle_drawer(f){ const d=document.getElementById('drawer'); const o=document.getElementById('drawer_overlay'); if(f===false||d.classList.contains('open')){d.classList.remove('open');o.classList.remove('open');}else{d.classList.add('open');o.classList.add('open');} }
function toggle_filters(){ document.getElementById('filters_bar').classList.toggle('open'); }
function modal_open(){ document.getElementById('e_id').value=''; document.getElementById('e_data').value=new Date().toISOString().split('T')[0]; populate_cats(); document.getElementById('modal_overlay').classList.add('open'); }
function modal_close(){ document.getElementById('modal_overlay').classList.remove('open'); }
function populate_cats(){ const s=document.getElementById('e_cat'); s.innerHTML=''; const f=document.getElementById('f_cat'); f.innerHTML='<option value="todos">Categoria</option>'; DATA.cats.forEach(c=>{ s.innerHTML+=`<option>${c.nome}</option>`; f.innerHTML+=`<option>${c.nome}</option>`; }); }
function edit_item(id){ const r=DATA.recs.find(i=>i.id===id); document.getElementById('e_id').value=r.id; document.getElementById('e_titulo').value=r.titulo; document.getElementById('e_data').value=r.data; document.getElementById('e_valor').value=r.valor; populate_cats(); document.getElementById('e_cat').value=r.cat; document.getElementById('e_status').value=r.status; document.getElementById('modal_overlay').classList.add('open'); }