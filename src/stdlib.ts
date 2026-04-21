import * as fs   from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { Ambiente } from "./runtime";

/**
 * Injeta todas as funções nativas do Xodó no ambiente global
 * antes de o script .xo começar a rodar.
 */
export function injetarStdlib(env: Ambiente): void {

    // ── Tier 1: I/O essencial ─────────────────────────────────────────────────

    env.declarar("ler_arquivo", async (caminho: string): Promise<string> => {
        const abs = path.resolve(caminho);
        if (!fs.existsSync(abs)) {
            throw new Error(`ler_arquivo: arquivo não encontrado: ${abs}`);
        }
        return fs.readFileSync(abs, "utf-8");
    });

    env.declarar("escrever_arquivo", async (caminho: string, conteudo: string): Promise<void> => {
        const abs = path.resolve(caminho);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, String(conteudo), "utf-8");
    });

    env.declarar("ler_entrada", async (prompt?: string): Promise<string> => {
        if (prompt) process.stdout.write(String(prompt));
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

    env.declarar("buscar", async (url: string, opcoes?: Record<string, any>): Promise<any> => {
        let resposta: Response;
        try {
            resposta = await fetch(url, opcoes);
        } catch {
            throw new Error(`buscar: não foi possível conectar em ${url}`);
        }
        if (!resposta.ok) {
            throw new Error(`buscar: servidor retornou ${resposta.status} em ${url}`);
        }
        const tipo = resposta.headers.get("content-type") ?? "";
        return tipo.includes("application/json") ? resposta.json() : resposta.text();
    });

    // ── Tier 2: Utilitários de Vibe Coding ────────────────────────────────────

    env.declarar("esperar", (ms: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, Number(ms)))
    );

    env.declarar("de_json", (texto: string): any => {
        try {
            return JSON.parse(texto);
        } catch {
            throw new Error(`de_json: não é um JSON válido`);
        }
    });

    env.declarar("para_json", (obj: any): string =>
        JSON.stringify(obj, null, 2)
    );

    env.declarar("agora", (): number => Date.now());

    // ── Tier 3: Qualidade de vida ─────────────────────────────────────────────

    env.declarar("tamanho", (valor: any): number => {
        if (typeof valor === "string")          return valor.length;
        if (Array.isArray(valor))               return valor.length;
        if (valor && typeof valor === "object") return Object.keys(valor).length;
        throw new Error(`tamanho: tipo não suportado (${typeof valor})`);
    });

    env.declarar("env", (nome: string): string | null =>
        process.env[nome] ?? null
    );

    env.declarar("listar_arquivos", async (pasta: string): Promise<string[]> => {
        const abs = path.resolve(pasta);
        if (!fs.existsSync(abs)) {
            throw new Error(`listar_arquivos: pasta não encontrada: ${abs}`);
        }
        return fs.readdirSync(abs).map((f) => path.join(pasta, f));
    });

    // ── Tier 4: Operações de Lista ────────────────────────────────────────────

    env.declarar("adicionar", (lista: any[], item: any): any[] => {
        if (!Array.isArray(lista)) throw new Error(`adicionar: primeiro argumento deve ser uma lista`);
        return [...lista, item];
    });

    env.declarar("remover", (lista: any[], indice: number): any[] => {
        if (!Array.isArray(lista)) throw new Error(`remover: primeiro argumento deve ser uma lista`);
        const copia = [...lista];
        copia.splice(Number(indice), 1);
        return copia;
    });

    env.declarar("fatiar", (lista: any[], inicio: number, fim?: number): any[] => {
        if (!Array.isArray(lista)) throw new Error(`fatiar: primeiro argumento deve ser uma lista`);
        return lista.slice(Number(inicio), fim !== undefined ? Number(fim) : undefined);
    });

    env.declarar("juntar", (lista: any[], separador = ", "): string => {
        if (!Array.isArray(lista)) throw new Error(`juntar: primeiro argumento deve ser uma lista`);
        return lista.map(String).join(String(separador));
    });

    env.declarar("inverter", (lista: any[]): any[] => {
        if (!Array.isArray(lista)) throw new Error(`inverter: primeiro argumento deve ser uma lista`);
        return [...lista].reverse();
    });

    env.declarar("contem", (lista: any, item: any): boolean => {
        if (Array.isArray(lista)) return (lista as any[]).includes(item);
        if (typeof lista === "string") return (lista as string).includes(String(item));
        throw new Error(`contem: primeiro argumento deve ser lista ou texto`);
    });

    env.declarar("primeiro", (lista: any[]): any => {
        if (!Array.isArray(lista)) throw new Error(`primeiro: esperava lista`);
        return lista[0] ?? null;
    });

    env.declarar("ultimo", (lista: any[]): any => {
        if (!Array.isArray(lista)) throw new Error(`ultimo: esperava lista`);
        return lista[lista.length - 1] ?? null;
    });

    // ── Tier 5: Texto ─────────────────────────────────────────────────────────

    env.declarar("maiusculo", (texto: string): string => String(texto).toUpperCase());
    env.declarar("minusculo", (texto: string): string => String(texto).toLowerCase());
    env.declarar("aparar",    (texto: string): string => String(texto).trim());
    env.declarar("separar",   (texto: string, sep: string): string[] => String(texto).split(String(sep)));
    env.declarar("substituir", (texto: string, de: string, para: string): string =>
        String(texto).replaceAll(String(de), String(para))
    );
    env.declarar("começa_com", (texto: string, prefixo: string): boolean =>
        String(texto).startsWith(String(prefixo))
    );
    env.declarar("termina_com", (texto: string, sufixo: string): boolean =>
        String(texto).endsWith(String(sufixo))
    );

    // ── Tier 6: Matemática ────────────────────────────────────────────────────

    env.declarar("arredondar", (n: number): number => Math.round(Number(n)));
    env.declarar("piso",       (n: number): number => Math.floor(Number(n)));
    env.declarar("teto",       (n: number): number => Math.ceil(Number(n)));
    env.declarar("absoluto",   (n: number): number => Math.abs(Number(n)));
    env.declarar("aleatorio",  (): number => Math.random());
    env.declarar("potencia",   (base: number, exp: number): number => Math.pow(Number(base), Number(exp)));
    env.declarar("raiz",       (n: number): number => Math.sqrt(Number(n)));
    env.declarar("numero",     (v: any): number => Number(v));
    env.declarar("texto",      (v: any): string => v === null || v === undefined ? "nulo" : String(v));

    // ── Tier 7: Automação de OS (Trick Shots via PowerShell/CMD) ──────────────

    env.declarar("executar_comando", (cmd: string): string => {
        try {
            return execSync(String(cmd), { encoding: "utf-8" });
        } catch (e) {
            throw new Error(`executar_comando: falha ao rodar '${cmd}': ${(e as Error).message}`);
        }
    });

    env.declarar("area_transferencia", (texto?: string): string | null => {
        if (texto !== undefined) {
            const b64 = Buffer.from(String(texto)).toString("base64");
            const ps = `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')) | Set-Clipboard`;
            execSync(`powershell -Command "${ps}"`);
            return null;
        } else {
            return execSync("powershell -Command Get-Clipboard", { encoding: "utf-8" }).trim();
        }
    });

    env.declarar("notificar", (titulo: string, msg: string): void => {
        const ps = `[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); ` +
                   `$obj = New-Object System.Windows.Forms.NotifyIcon; ` +
                   `$obj.Icon = [System.Drawing.SystemIcons]::Information; ` +
                   `$obj.Visible = $true; ` +
                   `$obj.ShowBalloonTip(5000, '${titulo}', '${msg}', [System.Windows.Forms.ToolTipIcon]::Info)`;
        execSync(`powershell -Command "${ps}"`);
    });
}
