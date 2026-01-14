// --- CONFIGURAÇÃO E SETUP ---

let CONFIG = {};

function init_setup() {
    const local_conf = localStorage.getItem('ton_config');
    if (local_conf) {
        try {
            CONFIG = JSON.parse(local_conf);
            // Verifica se a config tem estrutura nova
            if (!CONFIG.csvs || !CONFIG.csvs.rec) throw new Error("Config antiga");
            
            if(typeof verificar_token_remoto === 'function') verificar_token_remoto();
        } catch(e) {
            localStorage.clear(); // Limpa config ruim
            show_screen('screen_setup');
        }
    } else {
        show_screen('screen_setup');
    }
}

function hard_reset() {
    if(confirm("ATENÇÃO: Isso apagará todas as conexões e o login deste navegador. Continuar?")) {
        localStorage.clear();
        window.location.reload();
    }
}

async function iniciar_diagnostico_setup() {
    const area = document.getElementById('setup_diag');
    area.style.display = 'block'; area.innerHTML = '';
    
    const add_check = (label, st) => {
        const icon = st==='ok'?'<i class="ph ph-check-circle"></i>':(st==='load'?'<i class="ph ph-spinner"></i>':'<i class="ph ph-x-circle"></i>');
        const cls = st==='ok'?'d-ok':(st==='load'?'d-load':'d-err');
        area.innerHTML += `<div class="diag-item"><div class="d-icon ${cls}">${icon}</div><span>${label}</span></div>`;
    };

    const csv_rec = document.getElementById('cfg_csv_rec').value;
    const csv_cat = document.getElementById('cfg_csv_cat').value;
    const csv_log = document.getElementById('cfg_csv_log').value;
    const form_rec = document.getElementById('cfg_form_rec').value;
    const form_cat = document.getElementById('cfg_form_cat').value;
    const form_log = document.getElementById('cfg_form_log').value;

    if(!csv_rec || !csv_cat || !csv_log || !form_rec || !form_cat || !form_log) { alert('Preencha tudo.'); return; }

    const map_rec = { id:'TAG_ID', titulo:'TAG_TITULO', data:'TAG_DATA', hora:'TAG_HORA', valor:'TAG_VALOR', cat:'TAG_CAT', rec:'TAG_REC', status:'TAG_STATUS', det:'TAG_DET', ts:'TAG_TS', del:'TAG_DEL' };
    const map_cat = { id:'TAG_ID', nome:'TAG_NOME', ts:'TAG_TS', del:'TAG_DEL' };
    const map_log = { status:'TAG_STATUS', data:'TAG_DATA', agent:'TAG_AGENT', screen:'TAG_SCREEN', ip:'TAG_IP' };

    const c_rec = parse_link(form_rec, map_rec); add_check('Form Registros', c_rec?'ok':'err');
    const c_cat = parse_link(form_cat, map_cat); add_check('Form Listas', c_cat?'ok':'err');
    const c_log = parse_link(form_log, map_log); add_check('Form Logs', c_log?'ok':'err');

    if(!c_rec || !c_cat || !c_log) return;

    add_check('Testando Conexão CSV...', 'load');
    try {
        const res = await fetch(csv_cat + '&t=' + Date.now());
        if(res.ok) {
            area.lastElementChild.innerHTML = `<div class="d-icon d-ok"><i class="ph ph-check-circle"></i></div><span>Conexão OK</span>`;
            
            const conf = { 
                csvs: { rec: csv_rec, cat: csv_cat, log: csv_log },
                forms: { rec: c_rec, cat: c_cat, log: c_log } 
            };
            localStorage.setItem('ton_config', JSON.stringify(conf));
            CONFIG = conf;
            setTimeout(() => verificar_token_remoto(), 1000);
        } else throw new Error();
    } catch(e) {
        area.lastElementChild.innerHTML = `<div class="d-icon d-err"><i class="ph ph-x-circle"></i></div><span>Erro CSV: Inacessível</span>`;
    }
}