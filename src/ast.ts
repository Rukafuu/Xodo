/**
 * AST do Xodó v0.2 — cada nó tem `tipo` como discriminante literal,
 * o que permite exhaustive checking no runtime com switch/case.
 */

// Union de todos os nós possíveis
export type Nodo =
    | Programa
    | DeclaracaoVariavel
    | DeclaracaoCall
    | InstrucaoSe
    | InstrucaoTente
    | InstrucaoExpressao
    | InstrucaoEnquanto
    | InstrucaoParaCada
    | InstrucaoRetornar
    | InstrucaoUsar
    | InstrucaoComContexto
    | InstrucaoParar
    | InstrucaoProximo
    | InstrucaoExpressao
    | ExpressaoAsk
    | ExpressaoEvoke
    | ExpressaoInvocacao
    | ExpressaoUnaria
    | AcessoMembro
    | AcessoIndice
    | ExpressaoBinaria
    | ExpressaoInterpolada
    | ObjetoLiteral
    | ListaLiteral
    | CampoObjeto
    | TipoXodo
    | Identificador
    | LiteralString
    | LiteralNumero
    | LiteralBooleano
    | LiteralNulo;

// ─── Raiz ────────────────────────────────────────────────────────────────────

export interface Programa {
    tipo: "Programa";
    corpo: Nodo[];
}

// ─── Declarações ─────────────────────────────────────────────────────────────

/**
 * `nome = expr`  → constante: false
 * `nome := expr` → constante: true  (não pode ser reatribuído no runtime)
 */
export interface DeclaracaoVariavel {
    tipo: "DeclaracaoVariavel";
    nome: string;
    valor: Nodo;
    constante: boolean;
    linha: number;
}

/**
 * `call NomeDaFuncao(param1, param2) { ...corpo }`
 * Registra a função na tabela de símbolos do runtime.
 */
export interface DeclaracaoCall {
    tipo: "DeclaracaoCall";
    nome: string;
    params: string[];
    corpo: Nodo[];
    linha: number;
}

export interface InstrucaoUsar {
    tipo: "InstrucaoUsar";
    caminho: string;
    linha: number;
}

/**
 * com_contexto(texto) { ...corpo }
 * Adiciona um prompt de sistema temporário para todos os ask() internos.
 */
export interface InstrucaoComContexto {
    tipo: "InstrucaoComContexto";
    contexto: Nodo;
    corpo: Nodo[];
    linha: number;
}

// ─── Instruções de controle ───────────────────────────────────────────────────

export interface InstrucaoSe {
    tipo: "InstrucaoSe";
    condicao: Nodo;
    entao: Nodo[];
    senao?: Nodo[];
    linha: number;
}

/**
 * `tente { ...corpo } pegue(nomeErro) { ...tratamento }`
 */
export interface InstrucaoTente {
    tipo: "InstrucaoTente";
    corpo: Nodo[];
    nomeErro: string;
    pegue: Nodo[];
    linha: number;
}

/**
 * `enquanto(condicao) { ...corpo }`
 */
export interface InstrucaoEnquanto {
    tipo: "InstrucaoEnquanto";
    condicao: Nodo;
    corpo: Nodo[];
    linha: number;
}

/**
 * `para_cada(item em lista) { ...corpo }`
 */
export interface InstrucaoParaCada {
    tipo: "InstrucaoParaCada";
    variavel: string;
    iteravel: Nodo;
    corpo: Nodo[];
    linha: number;
}

/**
 * `retornar expr`
 */
export interface InstrucaoRetornar {
    tipo: "InstrucaoRetornar";
    valor?: Nodo;
    linha: number;
}

export interface InstrucaoParar {
    tipo: "InstrucaoParar";
    linha: number;
}

export interface InstrucaoProximo {
    tipo: "InstrucaoProximo";
    linha: number;
}

/** Expressão usada como instrução — ex: `AnalisarLog("texto")` */
export interface InstrucaoExpressao {
    tipo: "InstrucaoExpressao";
    expressao: Nodo;
    linha: number;
}

// ─── Expressões ───────────────────────────────────────────────────────────────

/**
 * `ask(entrada, modelo, sysPrompt)`
 * `ask(entrada, modelo, sysPrompt, def_saida)`
 */
export interface ExpressaoAsk {
    tipo: "ExpressaoAsk";
    entrada: Nodo;
    modelo: Nodo;
    sysPrompt: Nodo;
    schema?: Nodo;
    linha: number;
}

/** `Evoke(expr)` — saída no terminal */
export interface ExpressaoEvoke {
    tipo: "ExpressaoEvoke";
    valor: Nodo;
    linha: number;
}

/** `NomeDaFuncao(arg1, arg2)` — invocação de call declarado anteriormente */
export interface ExpressaoInvocacao {
    tipo: "ExpressaoInvocacao";
    nome: string;
    args: Nodo[];
    linha: number;
}

/** `nao expr` — negação unária lógica; `-expr` — negação numérica */
export interface ExpressaoUnaria {
    tipo: "ExpressaoUnaria";
    operador: "nao" | "-";
    operando: Nodo;
    linha: number;
}

/**
 * `objeto.campo` — acesso a membro (ex: `dados.nome`, `erro.log`)
 */
export interface AcessoMembro {
    tipo: "AcessoMembro";
    objeto: Nodo;
    campo: string;
    linha: number;
}

/**
 * `lista[indice]` — acesso por índice
 */
export interface AcessoIndice {
    tipo: "AcessoIndice";
    objeto: Nodo;
    indice: Nodo;
    linha: number;
}

/** `esquerda op direita` — operações binárias */
export interface ExpressaoBinaria {
    tipo: "ExpressaoBinaria";
    esquerda: Nodo;
    operador: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "e" | "ou";
    direita: Nodo;
    linha: number;
}

/**
 * String com interpolação: "Olá {nome}, você tem {idade} anos"
 * Armazenamos as partes como lista alternada de strings literais e expressões
 */
export interface ExpressaoInterpolada {
    tipo: "ExpressaoInterpolada";
    partes: (string | Nodo)[];   // string = texto literal, Nodo = expressão avaliada
    linha: number;
}

// ─── Literais e estruturas ────────────────────────────────────────────────────

/**
 * `{ chave: valor, ... }`
 */
export interface ObjetoLiteral {
    tipo: "ObjetoLiteral";
    campos: CampoObjeto[];
    linha: number;
}

/**
 * `[1, 2, 3]` — lista nativa
 */
export interface ListaLiteral {
    tipo: "ListaLiteral";
    elementos: Nodo[];
    linha: number;
}

export interface CampoObjeto {
    tipo: "CampoObjeto";
    chave: string;
    valor: Nodo;
    linha: number;
}

/** `texto` | `numero` | `booleano` — dentro de definições de schema */
export interface TipoXodo {
    tipo: "TipoXodo";
    nome: "texto" | "numero" | "booleano";
    linha: number;
}

export interface Identificador {
    tipo: "Identificador";
    nome: string;
    linha: number;
}

export interface LiteralString {
    tipo: "LiteralString";
    valor: string;
    linha: number;
}

export interface LiteralNumero {
    tipo: "LiteralNumero";
    valor: number;
    linha: number;
}

export interface LiteralBooleano {
    tipo: "LiteralBooleano";
    valor: boolean;
    linha: number;
}

export interface LiteralNulo {
    tipo: "LiteralNulo";
    linha: number;
}
