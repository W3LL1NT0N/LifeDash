// --- HELPERS GERAIS ---

async function sha256(s) {
    const b = new TextEncoder().encode(s);
    const h = await crypto.subtle.digest('SHA-256', b);
    return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2,'0')).join('');
}

// CORREÇÃO CRÍTICA: Parser que respeita colunas vazias (,,)
function parse_csv_simple(txt) {
    const rows = [];
    const lines = txt.split('\n');
    
    lines.forEach(line => {
        if(!line.trim()) return; // Ignora linhas vazias
        // Split por virgula, mas ignora virgulas dentro de aspas
        const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        // Limpa aspas extras
        const cleanRow = row.map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        rows.push(cleanRow);
    });
    return rows;
}

function parse_link(url, mapping) {
    try {
        if (!url.includes('viewform')) throw new Error();
        const base = url.split('/viewform')[0] + '/formResponse';
        const params = new URLSearchParams(url.split('?')[1]);
        const entries = {};
        for (let [key, tag] of Object.entries(mapping)) {
            params.forEach((val, pKey) => { if (val.trim() === tag) entries[key] = pKey; });
        }
        return { url: base, entries };
    } catch (e) { return null; }
}

async function send_form(cfg, data) {
    const fd = new URLSearchParams();
    for(let [key, entryId] of Object.entries(cfg.entries)) { 
        let val = data[key];
        if (val === undefined || val === null) val = '';
        fd.append(entryId, val); 
    }
    await fetch(cfg.url, { method: 'POST', mode: 'no-cors', body: fd });
}

function show_loader(show, msg) { 
    const l = document.getElementById('loader'); 
    if(show){ 
        l.style.display='flex'; 
        if(msg) document.getElementById('loader_msg').innerText=msg; 
    } else { 
        l.style.display='none'; 
    } 
}

function show_screen(id) { 
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); 
    const el = document.getElementById(id);
    if(el) el.classList.add('active'); 
}