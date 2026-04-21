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
exports.Interpretador = exports.Ambiente = void 0;
const lexer_1 = require("./lexer");
// ─── Sinal de retorno (usado para implementar `retornar` de calls) ────────────
class SinalRetornar {
    valor;
    constructor(valor) {
        this.valor = valor;
    }
}
class SinalParar {
}
class SinalProximo {
}
// ─── Ambiente (Tabela de Símbolos com escopo encadeado) ───────────────────────
class Ambiente {
    valores = new Map();
    constantes = new Set();
    pai;
    constructor(pai) {
        this.pai = pai;
    }
    declarar(nome, valor, constante = false) {
        if (this.constantes.has(nome)) {
            throw new Error(`[Runtime] '${nome}' é constante e não pode ser reatribuída.`);
        }
        this.valores.set(nome, valor);
        if (constante)
            this.constantes.add(nome);
    }
    atribuir(nome, valor) {
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
    buscar(nome) {
        if (this.valores.has(nome))
            return this.valores.get(nome);
        if (this.pai)
            return this.pai.buscar(nome);
        throw new Error(`[Runtime] Variável '${nome}' não foi declarada neste escopo.`);
    }
    existe(nome) {
        if (this.valores.has(nome))
            return true;
        if (this.pai)
            return this.pai.existe(nome);
        return false;
    }
}
exports.Ambiente = Ambiente;
// ─── Conversão def → JSON Schema ─────────────────────────────────────────────
function tipoParaJsonSchema(nome) {
    switch (nome) {
        case "texto": return "string";
        case "numero": return "number";
        case "booleano": return "boolean";
        default: throw new Error(`[Runtime] Tipo Xodó desconhecido: '${nome}'`);
    }
}
function converterDefParaSchema(def) {
    const properties = {};
    const required = [];
    for (const [chave, tipoXodo] of Object.entries(def)) {
        properties[chave] = { type: tipoParaJsonSchema(tipoXodo) };
        required.push(chave);
    }
    return { type: "object", properties, required };
}
// ─── ask() — fetch agnóstico para qualquer backend local ─────────────────────
async function executarAsk(entrada, modelo, sysPrompt, def) {
    const url = process.env.XODO_MODELO_URL ?? "http://localhost:11434/api/generate";
    const body = {
        model: modelo,
        prompt: entrada,
        system: sysPrompt,
        stream: false,
    };
    if (def) {
        body.format = converterDefParaSchema(def);
    }
    let resposta;
    try {
        resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }
    catch (e) {
        throw new Error(`[Runtime] Não foi possível conectar ao modelo em ${url}. ` +
            `Suba o Ollama ou configure XODO_MODELO_URL.`);
    }
    if (!resposta.ok) {
        const texto = await resposta.text();
        throw new Error(`[Runtime] Servidor retornou ${resposta.status}: ${texto}`);
    }
    const json = await resposta.json();
    return def ? JSON.parse(json.response) : json.response;
}
// ─── Interpretador principal ──────────────────────────────────────────────────
class Interpretador {
    global = new Ambiente();
    /** Hook para saída — pode ser sobrescrito pelo host (ex: IDE Tauri) */
    onOutput = (t) => console.log(t);
    /** Pilha de contextos ativos para IA (Phantom Contexts) */
    pilhaContexto = [];
    async executar(programa) {
        for (const nodo of programa.corpo) {
            const r = await this.executarNodo(nodo, this.global);
            // retornar no nível global é ignorado silenciosamente
            if (r instanceof SinalRetornar)
                break;
        }
    }
    variavelExiste(nome, env) {
        return env.existe(nome);
    }
    // Executa nós de instrução/declaração
    async executarNodo(nodo, env) {
        switch (nodo.tipo) {
            case "DeclaracaoVariavel": {
                const valor = await this.avaliar(nodo.valor, env);
                // Se não é constante e a variável já existe no escopo (re-atribuição)
                if (!nodo.constante && this.variavelExiste(nodo.nome, env)) {
                    env.atribuir(nodo.nome, valor);
                }
                else {
                    env.declarar(nodo.nome, valor, nodo.constante);
                }
                return;
            }
            case "DeclaracaoCall": {
                const chamavel = {
                    __xodoCall: true,
                    params: nodo.params,
                    corpo: nodo.corpo,
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
                }
                finally {
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
                }
                catch (e) {
                    if (e instanceof SinalRetornar || e instanceof SinalParar || e instanceof SinalProximo) {
                        throw e;
                    }
                    const escopoErro = new Ambiente(env);
                    escopoErro.declarar(nodo.nomeErro, {
                        log: e.message,
                        tipo: e.name,
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
                    }
                    catch (e) {
                        if (e instanceof SinalParar)
                            break;
                        if (e instanceof SinalProximo)
                            continue;
                        throw e;
                    }
                }
                return;
            }
            case "InstrucaoParaCada": {
                const lista = await this.avaliar(nodo.iteravel, env);
                if (!Array.isArray(lista)) {
                    throw new Error(`[Runtime] para_cada espera uma lista, mas recebeu ${typeof lista} na linha ${nodo.linha}.`);
                }
                for (const item of lista) {
                    try {
                        const escopoItem = new Ambiente(env);
                        escopoItem.declarar(nodo.variavel, item);
                        for (const inst of nodo.corpo) {
                            await this.executarNodo(inst, escopoItem);
                        }
                    }
                    catch (e) {
                        if (e instanceof SinalParar)
                            break;
                        if (e instanceof SinalProximo)
                            continue;
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
                    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
                    const path = await Promise.resolve().then(() => __importStar(require("path")));
                    const fullPath = path.resolve(nodo.caminho);
                    if (!fs.existsSync(fullPath)) {
                        throw new Error(`[Runtime] Arquivo para 'usar' não encontrado: ${fullPath}`);
                    }
                    const codigo = fs.readFileSync(fullPath, "utf-8");
                    const lexer = new lexer_1.Lexer(codigo);
                    const tokens = lexer.tokenizar();
                    const parser = new (await Promise.resolve().then(() => __importStar(require("./parser")))).Parser(tokens);
                    const programa = parser.parsear();
                    await this.executar(programa);
                }
                catch (e) {
                    throw new Error(`[Runtime] erro ao carregar módulo '${nodo.caminho}': ${e.message}`);
                }
                return;
            }
            default:
                throw new Error(`[Runtime] executarNodo recebeu nó inesperado: ${nodo.tipo}`);
        }
    }
    // Avalia nós de expressão e retorna um valor JS
    async avaliar(nodo, env) {
        switch (nodo.tipo) {
            // Literais
            case "LiteralString": return nodo.valor;
            case "LiteralNumero": return nodo.valor;
            case "LiteralBooleano": return nodo.valor;
            case "LiteralNulo": return null;
            // TipoXodo avaliado como string para converterDefParaSchema
            case "TipoXodo": return nodo.nome;
            case "Identificador":
                return env.buscar(nodo.nome);
            case "AcessoMembro": {
                const obj = await this.avaliar(nodo.objeto, env);
                if (obj === null || obj === undefined) {
                    throw new Error(`[Runtime] Acesso a '${nodo.campo}' em valor nulo (linha ${nodo.linha}).`);
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
                const elementos = [];
                for (const el of nodo.elementos) {
                    elementos.push(await this.avaliar(el, env));
                }
                return elementos;
            }
            case "ExpressaoUnaria": {
                const val = await this.avaliar(nodo.operando, env);
                if (nodo.operador === "nao")
                    return !val;
                if (nodo.operador === "-")
                    return -val;
                break;
            }
            case "ExpressaoBinaria": {
                // Curto-circuito para operadores lógicos
                if (nodo.operador === "e") {
                    const esq = await this.avaliar(nodo.esquerda, env);
                    if (!esq)
                        return esq;
                    return await this.avaliar(nodo.direita, env);
                }
                if (nodo.operador === "ou") {
                    const esq = await this.avaliar(nodo.esquerda, env);
                    if (esq)
                        return esq;
                    return await this.avaliar(nodo.direita, env);
                }
                const esq = await this.avaliar(nodo.esquerda, env);
                const dir = await this.avaliar(nodo.direita, env);
                switch (nodo.operador) {
                    case "+":
                        if (typeof esq === "number" && typeof dir === "number")
                            return esq + dir;
                        return String(esq) + String(dir);
                    case "-": return esq - dir;
                    case "*": return esq * dir;
                    case "/":
                        if (dir === 0)
                            throw new Error(`[Runtime] Divisão por zero na linha ${nodo.linha}.`);
                        return esq / dir;
                    case "%": return esq % dir;
                    case "==": return esq === dir;
                    case "!=": return esq !== dir;
                    case ">": return esq > dir;
                    case "<": return esq < dir;
                    case ">=": return esq >= dir;
                    case "<=": return esq <= dir;
                }
                break;
            }
            case "ExpressaoInterpolada": {
                let resultado = "";
                for (const parte of nodo.partes) {
                    if (typeof parte === "string") {
                        resultado += parte;
                    }
                    else {
                        const val = await this.avaliar(parte, env);
                        resultado += val === null || val === undefined ? "nulo" : String(val);
                    }
                }
                return resultado;
            }
            case "ObjetoLiteral": {
                const obj = {};
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
                const entrada = String(await this.avaliar(nodo.entrada, env));
                const modelo = String(await this.avaliar(nodo.modelo, env));
                let sysPrompt = String(await this.avaliar(nodo.sysPrompt, env));
                // Mescla os contextos da pilha se existirem
                if (this.pilhaContexto.length > 0) {
                    const ctxUnido = this.pilhaContexto.join(". ");
                    sysPrompt = `${ctxUnido}. ${sysPrompt}`;
                }
                const def = nodo.schema ? await this.avaliar(nodo.schema, env) : undefined;
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
                    const xCall = chamavel;
                    const escopoLocal = new Ambiente(xCall.closure);
                    xCall.params.forEach((param, i) => escopoLocal.declarar(param, args[i] ?? null));
                    try {
                        for (const inst of xCall.corpo) {
                            await this.executarNodo(inst, escopoLocal);
                        }
                    }
                    catch (e) {
                        if (e instanceof SinalRetornar)
                            return e.valor;
                        throw e;
                    }
                    return null;
                }
                throw new Error(`[Runtime] '${nodo.nome}' não é invocável (linha ${nodo.linha}).`);
            }
            // Nós de instrução não devem ser avaliados como expressão
            default:
                throw new Error(`[Runtime] avaliar() recebeu nó de instrução: ${nodo.tipo}`);
        }
    }
}
exports.Interpretador = Interpretador;
