// --- HELPERS GERAIS ---

async function sha256(s) {
    const b = new TextEncoder().encode(s);
    const h = await crypto.subtle.digest('SHA-256', b);
    return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2,'0')).join('');
}

// Parser CSV Resiliente
function parse_csv_simple(txt) {
    const rows = [];
    const lines = txt.split('\n');
    lines.forEach(line => {
        if(!line.trim()) return;
        // Split manual para garantir colunas vazias
        const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const cleanRow = row.map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        rows.push(cleanRow);
    });
    return rows;
}

// Parser Link Google Forms
function parse_link(url, mapping) {
    try {
        if (!url.includes('viewform')) throw new Error();
        const base = url.split('/viewform')[0] + '/formResponse';
        const params = new URLSearchParams(url.split('?')[1]);
        const entries = {};
        for (let [key, tag] of Object.entries(mapping)) {
            let found = false;
            params.forEach((val, pKey) => { if (val.trim() === tag) { entries[key] = pKey; found = true; } });
            // Se tag não encontrada, não adiciona ao map (ou avisa)
        }
        return { url: base, entries };
    } catch (e) { return null; }
}

async function send_form(cfg, data) {
    const fd = new URLSearchParams();
    for(let [key, entryId] of Object.entries(cfg.entries)) { 
        let val = data[key];
        if (val === undefined || val === null || val === false) val = 'False'; // Stringify bools
        if (val === true) val = 'True';
        fd.append(entryId, val); 
    }
    await fetch(cfg.url, { method: 'POST', mode: 'no-cors', body: fd });
}

// Data Helpers com Week Start Config
function get_date_range(p, weekStart = 0) { // 0 = Domingo, 1 = Segunda
    const h = new Date(); h.setHours(0,0,0,0);
    const e = new Date(); e.setHours(23,59,59,999);
    
    // Helper para mover dias
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const startOfWeek = (d) => {
        const x = new Date(d);
        const day = x.getDay();
        const diff = (day < weekStart ? 7 : 0) + day - weekStart;
        x.setDate(x.getDate() - diff);
        return x;
    };

    switch(p) {
        case 'hoje': return {start:h, end:e};
        case 'ontem': return {start:addDays(h,-1), end:addDays(e,-1)};
        case 'amanha': return {start:addDays(h,1), end:addDays(e,1)};
        
        case 'semana_atual': {
            const s = startOfWeek(h);
            const fin = addDays(s, 6); fin.setHours(23,59,59,999);
            return {start:s, end:fin};
        }
        case 'semana_passada': {
            const s = addDays(startOfWeek(h), -7);
            const fin = addDays(s, 6); fin.setHours(23,59,59,999);
            return {start:s, end:fin};
        }
        case 'semana_vem': {
            const s = addDays(startOfWeek(h), 7);
            const fin = addDays(s, 6); fin.setHours(23,59,59,999);
            return {start:s, end:fin};
        }
        
        case 'mes_atual': {
            const s = new Date(h.getFullYear(), h.getMonth(), 1);
            const fin = new Date(h.getFullYear(), h.getMonth() + 1, 0, 23, 59, 59);
            return {start:s, end:fin};
        }
        case 'mes_passado': {
            const s = new Date(h.getFullYear(), h.getMonth()-1, 1);
            const fin = new Date(h.getFullYear(), h.getMonth(), 0, 23, 59, 59);
            return {start:s, end:fin};
        }
        case 'mes_vem': {
            const s = new Date(h.getFullYear(), h.getMonth()+1, 1);
            const fin = new Date(h.getFullYear(), h.getMonth()+2, 0, 23, 59, 59);
            return {start:s, end:fin};
        }
        
        case 'ano_atual': {
            const s = new Date(h.getFullYear(), 0, 1);
            const fin = new Date(h.getFullYear(), 11, 31, 23, 59, 59);
            return {start:s, end:fin};
        }
        case 'ano_passado': {
            const s = new Date(h.getFullYear()-1, 0, 1);
            const fin = new Date(h.getFullYear()-1, 11, 31, 23, 59, 59);
            return {start:s, end:fin};
        }
        case 'ano_vem': {
            const s = new Date(h.getFullYear()+1, 0, 1);
            const fin = new Date(h.getFullYear()+1, 11, 31, 23, 59, 59);
            return {start:s, end:fin};
        }
        
        default: return null; // Tudo
    }
}

function show_loader(show, msg) { 
    const l = document.getElementById('loader'); 
    if(show){ l.style.display='flex'; if(msg) document.getElementById('loader_msg').innerText=msg; } 
    else { l.style.display='none'; } 
}