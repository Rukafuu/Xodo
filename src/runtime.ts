import * as AST from "./ast";
import { Lexer } from "./lexer";

// ─── Sinal de retorno (usado para implementar `retornar` de calls) ────────────

class SinalRetornar {
    constructor(public valor: any) {}
}

class SinalParar {}
class SinalProximo {}

// ─── Ambiente (Tabela de Símbolos com escopo encadeado) ───────────────────────

export class Ambiente {
    private valores    = new Map<string, any>();
    private constantes = new Set<string>();
    private pai?: Ambiente;

    constructor(pai?: Ambiente) {
        this.pai = pai;
    }

    declarar(nome: string, valor: any, constante = false): void {
        if (this.constantes.has(nome)) {
            throw new Error(`[Runtime] '${nome}' é constante e não pode ser reatribuída.`);
        }
        this.valores.set(nome, valor);
        if (constante) this.constantes.add(nome);
    }

    atribuir(nome: string, valor: any): void {
        if (this.valores.has(nome)) {
            if (this.constantes.has(nome)) {
                throw new Error(`[Runtime] '${nome}' é constante e não pode ser reatribuída.`);
            }
            this.valores.set(nome, valor);
            return;
        }
        if (this.pai) {
            this.pai.atribuir(nome, valor);
            return;
        }
        throw new Error(`[Runtime] Variável '${nome}' não foi declarada neste escopo.`);
    }

    buscar(nome: string): any {
        if (this.valores.has(nome)) return this.valores.get(nome);
        if (this.pai) return this.pai.buscar(nome);
        throw new Error(`[Runtime] Variável '${nome}' não foi declarada neste escopo.`);
    }

    existe(nome: string): boolean {
        if (this.valores.has(nome)) return true;
        if (this.pai) return this.pai.existe(nome);
        return false;
    }
}

// ─── Representação interna de um call declarado ───────────────────────────────

interface XodoCall {
    __xodoCall: true;
    params:     string[];
    corpo:      AST.Nodo[];
    closure:    Ambiente;   // escopo onde o call foi definido (closure léxico)
}

// ─── Conversão def → JSON Schema ─────────────────────────────────────────────

function tipoParaJsonSchema(nome: string): string {
    switch (nome) {
        case "texto":    return "string";
        case "numero":   return "number";
        case "booleano": return "boolean";
        default: throw new Error(`[Runtime] Tipo Xodó desconhecido: '${nome}'`);
    }
}

function converterDefParaSchema(def: Record<string, string>): object {
    const properties: Record<string, { type: string }> = {};
    const required: string[] = [];

    for (const [chave, tipoXodo] of Object.entries(def)) {
        properties[chave] = { type: tipoParaJsonSchema(tipoXodo) };
        required.push(chave);
    }

    return { type: "object", properties, required };
}

// ─── ask() — fetch agnóstico para qualquer backend local ─────────────────────

async function executarAsk(
    entrada:   string,
    modelo:    string,
    sysPrompt: string,
    def?:      Record<string, string>
): Promise<any> {
    const url = process.env.XODO_MODELO_URL ?? "http://localhost:11434/api/generate";

    const body: Record<string, any> = {
        model:  modelo,
        prompt: entrada,
        system: sysPrompt,
        stream: false,
    };

    if (def) {
        body.format = converterDefParaSchema(def);
    }

    let resposta: Response;
    try {
        resposta = await fetch(url, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(body),
        });
    } catch (e) {
        throw new Error(
            `[Runtime] Não foi possível conectar ao modelo em ${url}. ` +
            `Suba o Ollama ou configure XODO_MODELO_URL.`
        );
    }

    if (!resposta.ok) {
        const texto = await resposta.text();
        throw new Error(`[Runtime] Servidor retornou ${resposta.status}: ${texto}`);
    }

    const json = await resposta.json() as { response: string };
    return def ? JSON.parse(json.response) : json.response;
}

// ─── Interpretador principal ──────────────────────────────────────────────────

export class Interpretador {
    public global = new Ambiente();
    /** Hook para saída — pode ser sobrescrito pelo host (ex: IDE Tauri) */
    public onOutput: (texto: string) => void = (t) => console.log(t);
    
    /** Hook para Debugger — chama antes de cada instrução */
    public onPasso: (linha: number) => Promise<void> | void = () => {};
    public debugMode: boolean = false;
    
    /** Pilha de contextos ativos para IA (Phantom Contexts) */
    private pilhaContexto: string[] = [];

    async executar(programa: AST.Programa): Promise<void> {
        for (const nodo of programa.corpo) {
            const r = await this.executarNodo(nodo, this.global);
            // retornar no nível global é ignorado silenciosamente
            if (r instanceof SinalRetornar) break;
        }
    }

    private variavelExiste(nome: string, env: Ambiente): boolean {
        return env.existe(nome);
    }

    // Executa nós de instrução/declaração
    private async executarNodo(nodo: AST.Nodo, env: Ambiente): Promise<any> {
        if (this.debugMode && (nodo as any).linha) {
            await this.onPasso((nodo as any).linha);
            // Delay artificial para o olho humano acompanhar
            await new Promise(r => setTimeout(r, 400));
        }

        switch (nodo.tipo) {

            case "DeclaracaoVariavel": {
                const valor = await this.avaliar(nodo.valor, env);
                // Se não é constante e a variável já existe no escopo (re-atribuição)
                if (!nodo.constante && this.variavelExiste(nodo.nome, env)) {
                    env.atribuir(nodo.nome, valor);
                } else {
                    env.declarar(nodo.nome, valor, nodo.constante);
                }
                return;
            }

            case "DeclaracaoCall": {
                const chamavel: XodoCall = {
                    __xodoCall: true,
                    params:  nodo.params,
                    corpo:   nodo.corpo,
                    closure: env,
                };
                env.declarar(nodo.nome, chamavel);
                return;
            }

            case "InstrucaoExpressao": {
                await this.avaliar(nodo.expressao, env);
                return;
            }

            case "InstrucaoComContexto": {
                const ctxVal = String(await this.avaliar(nodo.contexto, env));
                this.pilhaContexto.push(ctxVal);
                try {
                    for (const inst of nodo.corpo) {
                        await this.executarNodo(inst, env);
                    }
                } finally {
                    this.pilhaContexto.pop();
                }
                return;
            }

            case "InstrucaoSe": {
                const condicao = await this.avaliar(nodo.condicao, env);
                const bloco = condicao ? nodo.entao : (nodo.senao ?? []);
                for (const inst of bloco) {
                    await this.executarNodo(inst, env);
                }
                return;
            }

            case "InstrucaoTente": {
                try {
                    for (const inst of nodo.corpo) {
                        await this.executarNodo(inst, env);
                    }
                } catch (e) {
                    if (e instanceof SinalRetornar || e instanceof SinalParar || e instanceof SinalProximo) {
                        throw e;
                    }
                    const escopoErro = new Ambiente(env);
                    escopoErro.declarar(nodo.nomeErro, {
                        log: (e as Error).message,
                        tipo: (e as Error).name,
                    });
                    for (const inst of nodo.pegue) {
                        await this.executarNodo(inst, escopoErro);
                    }
                }
                return;
            }

            case "InstrucaoEnquanto": {
                let iteracoes = 0;
                while (await this.avaliar(nodo.condicao, env)) {
                    if (++iteracoes > 100_000) {
                        throw new Error(`[Runtime] Loop infinito detectado na linha ${nodo.linha} (limite: 100.000 iterações).`);
                    }
                    try {
                        const escopoLoop = new Ambiente(env);
                        for (const inst of nodo.corpo) {
                            await this.executarNodo(inst, escopoLoop);
                        }
                    } catch (e) {
                        if (e instanceof SinalParar) break;
                        if (e instanceof SinalProximo) continue;
                        throw e;
                    }
                }
                return;
            }

            case "InstrucaoParaCada": {
                const lista = await this.avaliar(nodo.iteravel, env);
                if (!Array.isArray(lista)) {
                    throw new Error(
                        `[Runtime] para_cada espera uma lista, mas recebeu ${typeof lista} na linha ${nodo.linha}.`
                    );
                }
                for (const item of lista) {
                    try {
                        const escopoItem = new Ambiente(env);
                        escopoItem.declarar(nodo.variavel, item);
                        for (const inst of nodo.corpo) {
                            await this.executarNodo(inst, escopoItem);
                        }
                    } catch (e) {
                        if (e instanceof SinalParar) break;
                        if (e instanceof SinalProximo) continue;
                        throw e;
                    }
                }
                return;
            }

            case "InstrucaoRetornar": {
                const valor = nodo.valor ? await this.avaliar(nodo.valor, env) : null;
                throw new SinalRetornar(valor);
            }

            case "InstrucaoParar": {
                throw new SinalParar();
            }

            case "InstrucaoProximo": {
                throw new SinalProximo();
            }

            case "InstrucaoUsar": {
                // Para o comando 'usar', precisamos ler o arquivo relativo ao processo
                // Nota: Em ambientes web, isso deve ser injetado por fora.
                try {
                    const fs = await import("fs");
                    const path = await import("path");
                    const fullPath = path.resolve(nodo.caminho);
                    if (!fs.existsSync(fullPath)) {
                        throw new Error(`[Runtime] Arquivo para 'usar' não encontrado: ${fullPath}`);
                    }
                    const codigo = fs.readFileSync(fullPath, "utf-8");
                    
                    const lexer = new Lexer(codigo);
                    const tokens = lexer.tokenizar();
                    const parser = new (await import("./parser")).Parser(tokens);
                    const programa = parser.parsear();
                    
                    await this.executar(programa);
                } catch (e) {
                    throw new Error(`[Runtime] erro ao carregar módulo '${nodo.caminho}': ${(e as Error).message}`);
                }
                return;
            }

            default:
                throw new Error(`[Runtime] executarNodo recebeu nó inesperado: ${(nodo as any).tipo}`);
        }
    }

    // Avalia nós de expressão e retorna um valor JS
    async avaliar(nodo: AST.Nodo, env: Ambiente): Promise<any> {
        switch (nodo.tipo) {

            // Literais
            case "LiteralString":   return nodo.valor;
            case "LiteralNumero":   return nodo.valor;
            case "LiteralBooleano": return nodo.valor;
            case "LiteralNulo":     return null;

            // TipoXodo avaliado como string para converterDefParaSchema
            case "TipoXodo": return nodo.nome;

            case "Identificador":
                return env.buscar(nodo.nome);

            case "AcessoMembro": {
                const obj = await this.avaliar(nodo.objeto, env);
                if (obj === null || obj === undefined) {
                    throw new Error(
                        `[Runtime] Acesso a '${nodo.campo}' em valor nulo (linha ${nodo.linha}).`
                    );
                }
                return obj[nodo.campo];
            }

            case "AcessoIndice": {
                const obj = await this.avaliar(nodo.objeto, env);
                const idx = await this.avaliar(nodo.indice, env);
                if (obj === null || obj === undefined) {
                    throw new Error(`[Runtime] Tentativa de acessar índice em valor nulo (linha ${nodo.linha}).`);
                }
                return obj[idx];
            }

            case "ListaLiteral": {
                const elementos: any[] = [];
                for (const el of nodo.elementos) {
                    elementos.push(await this.avaliar(el, env));
                }
                return elementos;
            }

            case "ExpressaoUnaria": {
                const val = await this.avaliar(nodo.operando, env);
                if (nodo.operador === "nao") return !val;
                if (nodo.operador === "-")   return -(val as number);
                break;
            }

            case "ExpressaoBinaria": {
                // Curto-circuito para operadores lógicos
                if (nodo.operador === "e") {
                    const esq = await this.avaliar(nodo.esquerda, env);
                    if (!esq) return esq;
                    return await this.avaliar(nodo.direita, env);
                }
                if (nodo.operador === "ou") {
                    const esq = await this.avaliar(nodo.esquerda, env);
                    if (esq) return esq;
                    return await this.avaliar(nodo.direita, env);
                }

                const esq = await this.avaliar(nodo.esquerda, env);
                const dir = await this.avaliar(nodo.direita, env);

                switch (nodo.operador) {
                    case "+":
                        if (typeof esq === "number" && typeof dir === "number") return esq + dir;
                        return String(esq) + String(dir);
                    case "-":  return (esq as number) - (dir as number);
                    case "*":  return (esq as number) * (dir as number);
                    case "/":
                        if ((dir as number) === 0) throw new Error(`[Runtime] Divisão por zero na linha ${nodo.linha}.`);
                        return (esq as number) / (dir as number);
                    case "%":  return (esq as number) % (dir as number);
                    case "==": return esq === dir;
                    case "!=": return esq !== dir;
                    case ">":  return (esq as number) >  (dir as number);
                    case "<":  return (esq as number) <  (dir as number);
                    case ">=": return (esq as number) >= (dir as number);
                    case "<=": return (esq as number) <= (dir as number);
                }
                break;
            }

            case "ExpressaoInterpolada": {
                let resultado = "";
                for (const parte of nodo.partes) {
                    if (typeof parte === "string") {
                        resultado += parte;
                    } else {
                        const val = await this.avaliar(parte, env);
                        resultado += val === null || val === undefined ? "nulo" : String(val);
                    }
                }
                return resultado;
            }

            case "ObjetoLiteral": {
                const obj: Record<string, any> = {};
                for (const campo of nodo.campos) {
                    obj[campo.chave] = await this.avaliar(campo.valor, env);
                }
                return obj;
            }

            case "ExpressaoEvoke": {
                const valor = await this.avaliar(nodo.valor, env);
                const texto = typeof valor === "object" && valor !== null
                    ? JSON.stringify(valor, null, 2)
                    : String(valor ?? "nulo");
                this.onOutput(texto);
                return valor;
            }

            case "ExpressaoAsk": {
                const entrada   = String(await this.avaliar(nodo.entrada,   env));
                const modelo    = String(await this.avaliar(nodo.modelo,    env));
                
                let sysPrompt = String(await this.avaliar(nodo.sysPrompt, env));
                
                // Mescla os contextos da pilha se existirem
                if (this.pilhaContexto.length > 0) {
                    const ctxUnido = this.pilhaContexto.join(". ");
                    sysPrompt = `${ctxUnido}. ${sysPrompt}`;
                }

                const def       = nodo.schema ? await this.avaliar(nodo.schema, env) : undefined;
                return await executarAsk(entrada, modelo, sysPrompt, def);
            }

            case "ExpressaoInvocacao": {
                const chamavel = env.buscar(nodo.nome);
                const args = await Promise.all(nodo.args.map(a => this.avaliar(a, env)));

                // Função nativa da stdlib (JS puro)
                if (typeof chamavel === "function") {
                    return await chamavel(...args);
                }

                // Call declarado em Xodó
                if (chamavel?.__xodoCall) {
                    const xCall = chamavel as XodoCall;
                    const escopoLocal = new Ambiente(xCall.closure);
                    xCall.params.forEach((param, i) => escopoLocal.declarar(param, args[i] ?? null));
                    
                    try {
                        for (const inst of xCall.corpo) {
                            await this.executarNodo(inst, escopoLocal);
                        }
                    } catch (e) {
                        if (e instanceof SinalRetornar) return e.valor;
                        throw e;
                    }
                    return null;
                }

                throw new Error(`[Runtime] '${nodo.nome}' não é invocável (linha ${nodo.linha}).`);
            }

            // Nós de instrução não devem ser avaliados como expressão
            default:
                throw new Error(`[Runtime] avaliar() recebeu nó de instrução: ${(nodo as any).tipo}`);
        }
    }
}
