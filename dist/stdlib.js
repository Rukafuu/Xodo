"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.injetarStdlib = injetarStdlib;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
/**
 * Injeta todas as funções nativas do Xodó no ambiente global
 * antes de o script .xo começar a rodar.
 */
function injetarStdlib(env) {
    // ── Tier 1: I/O essencial ─────────────────────────────────────────────────
    env.declarar("ler_arquivo", async (caminho) => {
        const abs = path.resolve(caminho);
        if (!fs.existsSync(abs)) {
            throw new Error(`ler_arquivo: arquivo não encontrado: ${abs}`);
        }
        return fs.readFileSync(abs, "utf-8");
    });
    env.declarar("escrever_arquivo", async (caminho, conteudo) => {
        const abs = path.resolve(caminho);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, String(conteudo), "utf-8");
    });
    env.declarar("ler_entrada", async (prompt) => {
        if (prompt)
            process.stdout.write(String(prompt));
        return new Promise((resolve) => {
            let buffer = "";
            process.stdin.setEncoding("utf-8");
            process.stdin.resume();
            process.stdin.on("data", (chunk) => {
                buffer += chunk;
                if (buffer.includes("\n")) {
                    process.stdin.pause();
                    resolve(buffer.split("\n")[0].trim());
                }
            });
        });
    });
    env.declarar("buscar", async (url, opcoes) => {
        let resposta;
        try {
            resposta = await fetch(url, opcoes);
        }
        catch {
            throw new Error(`buscar: não foi possível conectar em ${url}`);
        }
        if (!resposta.ok) {
            throw new Error(`buscar: servidor retornou ${resposta.status} em ${url}`);
        }
        const tipo = resposta.headers.get("content-type") ?? "";
        return tipo.includes("application/json") ? resposta.json() : resposta.text();
    });
    // ── Tier 2: Utilitários de Vibe Coding ────────────────────────────────────
    env.declarar("esperar", (ms) => new Promise((resolve) => setTimeout(resolve, Number(ms))));
    env.declarar("de_json", (texto) => {
        try {
            return JSON.parse(texto);
        }
        catch {
            throw new Error(`de_json: não é um JSON válido`);
        }
    });
    env.declarar("para_json", (obj) => JSON.stringify(obj, null, 2));
    env.declarar("agora", () => Date.now());
    // ── Tier 3: Qualidade de vida ─────────────────────────────────────────────
    env.declarar("tamanho", (valor) => {
        if (typeof valor === "string")
            return valor.length;
        if (Array.isArray(valor))
            return valor.length;
        if (valor && typeof valor === "object")
            return Object.keys(valor).length;
        throw new Error(`tamanho: tipo não suportado (${typeof valor})`);
    });
    env.declarar("env", (nome) => process.env[nome] ?? null);
    env.declarar("listar_arquivos", async (pasta) => {
        const abs = path.resolve(pasta);
        if (!fs.existsSync(abs)) {
            throw new Error(`listar_arquivos: pasta não encontrada: ${abs}`);
        }
        return fs.readdirSync(abs).map((f) => path.join(pasta, f));
    });
    // ── Tier 4: Operações de Lista ────────────────────────────────────────────
    env.declarar("adicionar", (lista, item) => {
        if (!Array.isArray(lista))
            throw new Error(`adicionar: primeiro argumento deve ser uma lista`);
        return [...lista, item];
    });
    env.declarar("remover", (lista, indice) => {
        if (!Array.isArray(lista))
            throw new Error(`remover: primeiro argumento deve ser uma lista`);
        const copia = [...lista];
        copia.splice(Number(indice), 1);
        return copia;
    });
    env.declarar("fatiar", (lista, inicio, fim) => {
        if (!Array.isArray(lista))
            throw new Error(`fatiar: primeiro argumento deve ser uma lista`);
        return lista.slice(Number(inicio), fim !== undefined ? Number(fim) : undefined);
    });
    env.declarar("juntar", (lista, separador = ", ") => {
        if (!Array.isArray(lista))
            throw new Error(`juntar: primeiro argumento deve ser uma lista`);
        return lista.map(String).join(String(separador));
    });
    env.declarar("inverter", (lista) => {
        if (!Array.isArray(lista))
            throw new Error(`inverter: primeiro argumento deve ser uma lista`);
        return [...lista].reverse();
    });
    env.declarar("contem", (lista, item) => {
        if (Array.isArray(lista))
            return lista.includes(item);
        if (typeof lista === "string")
            return lista.includes(String(item));
        throw new Error(`contem: primeiro argumento deve ser lista ou texto`);
    });
    env.declarar("primeiro", (lista) => {
        if (!Array.isArray(lista))
            throw new Error(`primeiro: esperava lista`);
        return lista[0] ?? null;
    });
    env.declarar("ultimo", (lista) => {
        if (!Array.isArray(lista))
            throw new Error(`ultimo: esperava lista`);
        return lista[lista.length - 1] ?? null;
    });
    // ── Tier 5: Texto ─────────────────────────────────────────────────────────
    env.declarar("maiusculo", (texto) => String(texto).toUpperCase());
    env.declarar("minusculo", (texto) => String(texto).toLowerCase());
    env.declarar("aparar", (texto) => String(texto).trim());
    env.declarar("separar", (texto, sep) => String(texto).split(String(sep)));
    env.declarar("substituir", (texto, de, para) => String(texto).replaceAll(String(de), String(para)));
    env.declarar("começa_com", (texto, prefixo) => String(texto).startsWith(String(prefixo)));
    env.declarar("termina_com", (texto, sufixo) => String(texto).endsWith(String(sufixo)));
    // ── Tier 6: Matemática ────────────────────────────────────────────────────
    env.declarar("arredondar", (n) => Math.round(Number(n)));
    env.declarar("piso", (n) => Math.floor(Number(n)));
    env.declarar("teto", (n) => Math.ceil(Number(n)));
    env.declarar("absoluto", (n) => Math.abs(Number(n)));
    env.declarar("aleatorio", () => Math.random());
    env.declarar("potencia", (base, exp) => Math.pow(Number(base), Number(exp)));
    env.declarar("raiz", (n) => Math.sqrt(Number(n)));
    env.declarar("numero", (v) => Number(v));
    env.declarar("texto", (v) => v === null || v === undefined ? "nulo" : String(v));
    // ── Tier 7: Automação de OS (Trick Shots via PowerShell/CMD) ──────────────
    env.declarar("executar_comando", (cmd) => {
        try {
            return (0, child_process_1.execSync)(String(cmd), { encoding: "utf-8" });
        }
        catch (e) {
            throw new Error(`executar_comando: falha ao rodar '${cmd}': ${e.message}`);
        }
    });
    env.declarar("area_transferencia", (texto) => {
        if (texto !== undefined) {
            const b64 = Buffer.from(String(texto)).toString("base64");
            const ps = `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')) | Set-Clipboard`;
            (0, child_process_1.execSync)(`powershell -Command "${ps}"`);
            return null;
        }
        else {
            return (0, child_process_1.execSync)("powershell -Command Get-Clipboard", { encoding: "utf-8" }).trim();
        }
    });
    env.declarar("notificar", (titulo, msg) => {
        const ps = `[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); ` +
            `$obj = New-Object System.Windows.Forms.NotifyIcon; ` +
            `$obj.Icon = [System.Drawing.SystemIcons]::Information; ` +
            `$obj.Visible = $true; ` +
            `$obj.ShowBalloonTip(5000, '${titulo}', '${msg}', [System.Windows.Forms.ToolTipIcon]::Info)`;
        (0, child_process_1.execSync)(`powershell -Command "${ps}"`);
    });
}
