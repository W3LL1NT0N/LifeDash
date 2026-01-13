// --- AUTENTICAÇÃO E LOGIN ---

let REMOTE_TOKEN_HASH = null;
let POLLING_INTERVAL = null;

async function verificar_token_remoto() {
    try {
        // Busca token no CSV de Listas/Categorias
        const res = await fetch(CONFIG.csvs.cat + '&t=' + Date.now());
        const txt = await res.text();
        const rows = parse_csv_simple(txt);
        
        let token = null;
        rows.forEach(r => {
            const idx = r.indexOf('sys_token');
            if (idx > -1 && r[idx+1]) token = r[idx+1];
        });

        if (token) {
            REMOTE_TOKEN_HASH = token;
            if(POLLING_INTERVAL) clearInterval(POLLING_INTERVAL);
            
            // Se já estiver logado (sessão local válida), vai pra Home
            const local_sessao = localStorage.getItem('ton_sessao');
            if(local_sessao === token) {
                window.location.href = 'home.html';
            } else {
                show_screen('screen_login');
            }
        } else {
            show_screen('screen_register');
        }
    } catch (e) {
        show_screen('screen_setup');
        alert('Erro conexão: ' + e.message);
    }
}

async function registrar_token() {
    const p1 = document.getElementById('reg_pass').value;
    const p2 = document.getElementById('reg_pass_conf').value;
    if(!p1 || p1 !== p2) return alert('Senhas inválidas');

    document.getElementById('btn_criar_token').disabled = true;
    document.getElementById('btn_criar_token').innerText = 'ENVIANDO...';

    const hash = await sha256(p1);
    const data = { id:'sys_token', nome:hash, ts:new Date().toISOString(), del:'false' };

    try {
        await send_form(CONFIG.forms.cat, data);
        iniciar_monitoramento();
    } catch(e) {
        alert('Erro: '+e.message);
        document.getElementById('btn_criar_token').disabled = false;
    }
}

function iniciar_monitoramento() {
    show_screen('screen_wait');
    let tries = 1;
    POLLING_INTERVAL = setInterval(async () => {
        document.getElementById('try_count').innerText = tries++;
        try {
            const res = await fetch(CONFIG.csvs.cat + '&t=' + Date.now());
            const txt = await res.text();
            if(txt.includes('sys_token')) {
                clearInterval(POLLING_INTERVAL);
                document.getElementById('wait_diag').lastElementChild.innerHTML = `<div class="d-icon d-ok"><i class="ph ph-check-circle"></i></div><span>Sincronizado!</span>`;
                setTimeout(() => verificar_token_remoto(), 1500);
            }
        } catch(e){}
    }, 10000);
}

async function auth() {
    const pass = document.getElementById('login_pass').value;
    const hash = await sha256(pass);
    if (hash === REMOTE_TOKEN_HASH) {
        localStorage.setItem('ton_sessao', hash); // Salva sessão
        window.location.href = 'home.html';
    } else {
        document.getElementById('login_err').innerText = 'Senha incorreta';
    }
}