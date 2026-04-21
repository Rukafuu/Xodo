"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const lexer_1 = require("./lexer");
class Parser {
    tokens;
    posicao = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    // ─── Helpers ──────────────────────────────────────────────────────────────
    atual() {
        return this.tokens[this.posicao];
    }
    peek(offset = 1) {
        return this.tokens[this.posicao + offset];
    }
    consumir(tipo) {
        const token = this.atual();
        if (token.tipo !== tipo) {
            throw new Error(`[Parser] Esperava ${tipo} mas encontrou ${token.tipo} ("${token.valor}") na linha ${token.linha}`);
        }
        this.posicao++;
        return token;
    }
    match(...tipos) {
        return tipos.includes(this.atual().tipo);
    }
    // ─── Ponto de entrada ─────────────────────────────────────────────────────
    parsear() {
        const corpo = [];
        while (!this.match(lexer_1.TokenType.EOF)) {
            corpo.push(this.parseDeclaracao());
        }
        return { tipo: "Programa", corpo };
    }
    // ─── Declarações ──────────────────────────────────────────────────────────
    parseDeclaracao() {
        const t = this.atual();
        if (t.tipo === lexer_1.TokenType.Call)
            return this.parseDeclaracaoCall();
        if (t.tipo === lexer_1.TokenType.Se)
            return this.parseInstrucaoSe();
        if (t.tipo === lexer_1.TokenType.Tente)
            return this.parseInstrucaoTente();
        if (t.tipo === lexer_1.TokenType.Enquanto)
            return this.parseInstrucaoEnquanto();
        if (t.tipo === lexer_1.TokenType.ParaCada)
            return this.parseInstrucaoParaCada();
        if (t.tipo === lexer_1.TokenType.Retornar)
            return this.parseInstrucaoRetornar();
        if (t.tipo === lexer_1.TokenType.Usar)
            return this.parseInstrucaoUsar();
        if (t.tipo === lexer_1.TokenType.ComContexto)
            return this.parseInstrucaoComContexto();
        if (t.tipo === lexer_1.TokenType.Parar)
            return this.parseInstrucaoParar();
        if (t.tipo === lexer_1.TokenType.Proximo)
            return this.parseInstrucaoProximo();
        // Identificador seguido de = ou := → declaração de variável
        if (t.tipo === lexer_1.TokenType.Identificador &&
            (this.peek().tipo === lexer_1.TokenType.Atribuicao ||
                this.peek().tipo === lexer_1.TokenType.AtribuicaoFixa)) {
            return this.parseDeclaracaoVariavel();
        }
        // Tudo mais é expressão usada como instrução (Evoke, invocação, etc.)
        const linha = t.linha;
        const expressao = this.parseExpressao();
        return { tipo: "InstrucaoExpressao", expressao, linha };
    }
    parseDeclaracaoVariavel() {
        const nomeToken = this.consumir(lexer_1.TokenType.Identificador);
        const constante = this.atual().tipo === lexer_1.TokenType.AtribuicaoFixa;
        this.posicao++; // consome = ou :=
        const valor = this.parseExpressao();
        return { tipo: "DeclaracaoVariavel", nome: nomeToken.valor, valor, constante, linha: nomeToken.linha };
    }
    parseDeclaracaoCall() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Call);
        const nome = this.consumir(lexer_1.TokenType.Identificador).valor;
        this.consumir(lexer_1.TokenType.AbrePar);
        const params = [];
        while (!this.match(lexer_1.TokenType.FechaPar)) {
            params.push(this.consumir(lexer_1.TokenType.Identificador).valor);
            if (this.match(lexer_1.TokenType.Virgula))
                this.posicao++;
        }
        this.consumir(lexer_1.TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "DeclaracaoCall", nome, params, corpo, linha };
    }
    parseInstrucaoSe() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Se);
        this.consumir(lexer_1.TokenType.AbrePar);
        const condicao = this.parseExpressao();
        this.consumir(lexer_1.TokenType.FechaPar);
        const entao = this.parseBloco();
        let senao;
        if (this.match(lexer_1.TokenType.Senao)) {
            this.posicao++;
            // senao se ...
            if (this.match(lexer_1.TokenType.Se)) {
                senao = [this.parseInstrucaoSe()];
            }
            else {
                senao = this.parseBloco();
            }
        }
        return { tipo: "InstrucaoSe", condicao, entao, senao, linha };
    }
    parseInstrucaoTente() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Tente);
        const corpo = this.parseBloco();
        this.consumir(lexer_1.TokenType.Pegue);
        this.consumir(lexer_1.TokenType.AbrePar);
        const nomeErro = this.consumir(lexer_1.TokenType.Identificador).valor;
        this.consumir(lexer_1.TokenType.FechaPar);
        const pegue = this.parseBloco();
        return { tipo: "InstrucaoTente", corpo, nomeErro, pegue, linha };
    }
    parseInstrucaoEnquanto() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Enquanto);
        this.consumir(lexer_1.TokenType.AbrePar);
        const condicao = this.parseExpressao();
        this.consumir(lexer_1.TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "InstrucaoEnquanto", condicao, corpo, linha };
    }
    parseInstrucaoParaCada() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.ParaCada);
        this.consumir(lexer_1.TokenType.AbrePar);
        const variavel = this.consumir(lexer_1.TokenType.Identificador).valor;
        this.consumir(lexer_1.TokenType.Em);
        const iteravel = this.parseExpressao();
        this.consumir(lexer_1.TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "InstrucaoParaCada", variavel, iteravel, corpo, linha };
    }
    parseInstrucaoRetornar() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Retornar);
        // Se a próxima token inicia uma expressão, parseia o valor de retorno
        const semValor = this.match(lexer_1.TokenType.FechaChave, lexer_1.TokenType.EOF);
        const valor = semValor ? undefined : this.parseExpressao();
        return { tipo: "InstrucaoRetornar", valor, linha };
    }
    parseInstrucaoUsar() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Usar);
        const caminho = this.consumir(lexer_1.TokenType.String).valor;
        return { tipo: "InstrucaoUsar", caminho, linha };
    }
    parseInstrucaoParar() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Parar);
        return { tipo: "InstrucaoParar", linha };
    }
    parseInstrucaoProximo() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Proximo);
        return { tipo: "InstrucaoProximo", linha };
    }
    parseInstrucaoComContexto() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.ComContexto);
        this.consumir(lexer_1.TokenType.AbrePar);
        const contexto = this.parseExpressao();
        this.consumir(lexer_1.TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "InstrucaoComContexto", contexto, corpo, linha };
    }
    parseBloco() {
        this.consumir(lexer_1.TokenType.AbreChave);
        const corpo = [];
        while (!this.match(lexer_1.TokenType.FechaChave) && !this.match(lexer_1.TokenType.EOF)) {
            corpo.push(this.parseDeclaracao());
        }
        this.consumir(lexer_1.TokenType.FechaChave);
        return corpo;
    }
    // ─── Expressões com precedência ───────────────────────────────────────────
    //
    //  Hierarquia (do mais baixo para o mais alto):
    //  1. parseOu        → ou
    //  2. parseE         → e
    //  3. parseComparacao → ==, !=, >, <, >=, <=
    //  4. parseAditiva   → +, -
    //  5. parseMultipl   → *, /, %
    //  6. parseUnaria    → nao, - (unário)
    //  7. parsePostfix   → .campo, [indice]
    //  8. parsePrimario  → literais, ask, Evoke, invocações, objetos, listas
    parseExpressao() {
        return this.parseOu();
    }
    parseOu() {
        let esquerda = this.parseE();
        while (this.match(lexer_1.TokenType.Ou)) {
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseE();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: "ou", direita, linha };
        }
        return esquerda;
    }
    parseE() {
        let esquerda = this.parseComparacao();
        while (this.match(lexer_1.TokenType.E)) {
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseComparacao();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: "e", direita, linha };
        }
        return esquerda;
    }
    parseComparacao() {
        let esquerda = this.parseAditiva();
        while (this.match(lexer_1.TokenType.Igualdade, lexer_1.TokenType.Diferente, lexer_1.TokenType.MaiorQue, lexer_1.TokenType.MenorQue, lexer_1.TokenType.MaiorIgual, lexer_1.TokenType.MenorIgual)) {
            const op = this.atual().valor;
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseAditiva();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: op, direita, linha };
        }
        return esquerda;
    }
    parseAditiva() {
        let esquerda = this.parseMultipl();
        while (this.match(lexer_1.TokenType.Soma, lexer_1.TokenType.Subtracao)) {
            const op = this.atual().valor;
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseMultipl();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: op, direita, linha };
        }
        return esquerda;
    }
    parseMultipl() {
        let esquerda = this.parseUnaria();
        while (this.match(lexer_1.TokenType.Multiplicacao, lexer_1.TokenType.Divisao, lexer_1.TokenType.Modulo)) {
            const op = this.atual().valor;
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseUnaria();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: op, direita, linha };
        }
        return esquerda;
    }
    parseUnaria() {
        if (this.match(lexer_1.TokenType.Nao)) {
            const linha = this.atual().linha;
            this.posicao++;
            const operando = this.parseUnaria();
            return { tipo: "ExpressaoUnaria", operador: "nao", operando, linha };
        }
        // Número negativo: -5 (mas só se seguido de número, não de expressão)
        if (this.match(lexer_1.TokenType.Subtracao) && this.peek().tipo === lexer_1.TokenType.Numero) {
            const linha = this.atual().linha;
            this.posicao++;
            const operando = this.parsePostfix();
            return { tipo: "ExpressaoUnaria", operador: "-", operando, linha };
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let nodo = this.parsePrimario();
        while (this.match(lexer_1.TokenType.Ponto) || this.match(lexer_1.TokenType.AbreColch)) {
            const linha = this.atual().linha;
            if (this.match(lexer_1.TokenType.Ponto)) {
                this.posicao++; // consome .
                const campo = this.consumir(lexer_1.TokenType.Identificador).valor;
                nodo = { tipo: "AcessoMembro", objeto: nodo, campo, linha };
            }
            else {
                this.posicao++; // consome [
                const indice = this.parseExpressao();
                this.consumir(lexer_1.TokenType.FechaColch);
                nodo = { tipo: "AcessoIndice", objeto: nodo, indice, linha };
            }
        }
        return nodo;
    }
    parsePrimario() {
        const t = this.atual();
        if (t.tipo === lexer_1.TokenType.Ask)
            return this.parseAsk();
        if (t.tipo === lexer_1.TokenType.Evoke)
            return this.parseEvoke();
        if (t.tipo === lexer_1.TokenType.AbreChave)
            return this.parseObjetoLiteral();
        if (t.tipo === lexer_1.TokenType.AbreColch)
            return this.parseListaLiteral();
        if (t.tipo === lexer_1.TokenType.String) {
            this.posicao++;
            // Verifica se tem interpolação: {variavel} ou {expressao}
            if (t.valor.includes('{')) {
                return this.parseInterpolacao(t.valor, t.linha);
            }
            return { tipo: "LiteralString", valor: t.valor, linha: t.linha };
        }
        if (t.tipo === lexer_1.TokenType.Numero) {
            this.posicao++;
            return { tipo: "LiteralNumero", valor: parseFloat(t.valor), linha: t.linha };
        }
        if (t.tipo === lexer_1.TokenType.Verdadeiro) {
            this.posicao++;
            return { tipo: "LiteralBooleano", valor: true, linha: t.linha };
        }
        if (t.tipo === lexer_1.TokenType.Falso) {
            this.posicao++;
            return { tipo: "LiteralBooleano", valor: false, linha: t.linha };
        }
        if (t.tipo === lexer_1.TokenType.Nulo) {
            this.posicao++;
            return { tipo: "LiteralNulo", linha: t.linha };
        }
        // texto / numero / booleano como valor dentro de um schema (def)
        if (t.tipo === lexer_1.TokenType.TipoTexto ||
            t.tipo === lexer_1.TokenType.TipoNumero ||
            t.tipo === lexer_1.TokenType.TipoBooleano) {
            this.posicao++;
            return { tipo: "TipoXodo", nome: t.valor, linha: t.linha };
        }
        // Identificador: invocação ou referência
        if (t.tipo === lexer_1.TokenType.Identificador) {
            this.posicao++;
            if (this.match(lexer_1.TokenType.AbrePar)) {
                this.consumir(lexer_1.TokenType.AbrePar);
                const args = [];
                while (!this.match(lexer_1.TokenType.FechaPar) && !this.match(lexer_1.TokenType.EOF)) {
                    args.push(this.parseExpressao());
                    if (this.match(lexer_1.TokenType.Virgula))
                        this.posicao++;
                }
                this.consumir(lexer_1.TokenType.FechaPar);
                return { tipo: "ExpressaoInvocacao", nome: t.valor, args, linha: t.linha };
            }
            return { tipo: "Identificador", nome: t.valor, linha: t.linha };
        }
        // Expressão agrupada por parênteses
        if (t.tipo === lexer_1.TokenType.AbrePar) {
            this.posicao++;
            const expr = this.parseExpressao();
            this.consumir(lexer_1.TokenType.FechaPar);
            return expr;
        }
        throw new Error(`[Parser] Token inesperado: ${t.tipo} ("${t.valor}") na linha ${t.linha}`);
    }
    // ─── Interpolação de string ────────────────────────────────────────────────
    /**
     * Converte "Olá {nome}, você tem {idade} anos" em um nó ExpressaoInterpolada.
     * Partes: ["Olá ", Identificador(nome), ", você tem ", Identificador(idade), " anos"]
     */
    parseInterpolacao(raw, linha) {
        const partes = [];
        let i = 0;
        let atual = "";
        while (i < raw.length) {
            if (raw[i] === '{') {
                // Fecha parte de texto literal
                if (atual.length > 0) {
                    partes.push(atual);
                    atual = "";
                }
                i++; // pula {
                let expr = "";
                let depth = 1;
                while (i < raw.length && depth > 0) {
                    if (raw[i] === '{')
                        depth++;
                    else if (raw[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            i++;
                            break;
                        }
                    }
                    expr += raw[i];
                    i++;
                }
                // Mini-parseia a expressão dentro das chaves
                const subLexer = new lexer_1.Lexer(expr.trim());
                const subTokens = subLexer.tokenizar();
                const subParser = new Parser(subTokens);
                const nodo = subParser.parseExpressao();
                partes.push(nodo);
            }
            else {
                atual += raw[i];
                i++;
            }
        }
        if (atual.length > 0)
            partes.push(atual);
        // Otimização: se só tem texto puro (sem expressões), retorna LiteralString
        if (partes.every(p => typeof p === "string")) {
            return { tipo: "LiteralString", valor: partes.join(""), linha };
        }
        return { tipo: "ExpressaoInterpolada", partes, linha };
    }
    // ─── Helpers de expressões nativas ───────────────────────────────────────
    parseAsk() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Ask);
        this.consumir(lexer_1.TokenType.AbrePar);
        const entrada = this.parseExpressao();
        this.consumir(lexer_1.TokenType.Virgula);
        const modelo = this.parseExpressao();
        this.consumir(lexer_1.TokenType.Virgula);
        const sysPrompt = this.parseExpressao();
        let schema;
        if (this.match(lexer_1.TokenType.Virgula)) {
            this.posicao++;
            schema = this.parseExpressao();
        }
        this.consumir(lexer_1.TokenType.FechaPar);
        return { tipo: "ExpressaoAsk", entrada, modelo, sysPrompt, schema, linha };
    }
    parseEvoke() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.Evoke);
        this.consumir(lexer_1.TokenType.AbrePar);
        const valor = this.parseExpressao();
        this.consumir(lexer_1.TokenType.FechaPar);
        return { tipo: "ExpressaoEvoke", valor, linha };
    }
    parseObjetoLiteral() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.AbreChave);
        const campos = [];
        while (!this.match(lexer_1.TokenType.FechaChave) && !this.match(lexer_1.TokenType.EOF)) {
            const chaveToken = this.consumir(lexer_1.TokenType.Identificador);
            this.consumir(lexer_1.TokenType.DoisPontos);
            const valor = this.parseExpressao();
            campos.push({ tipo: "CampoObjeto", chave: chaveToken.valor, valor, linha: chaveToken.linha });
            if (this.match(lexer_1.TokenType.Virgula))
                this.posicao++;
        }
        this.consumir(lexer_1.TokenType.FechaChave);
        return { tipo: "ObjetoLiteral", campos, linha };
    }
    parseListaLiteral() {
        const linha = this.atual().linha;
        this.consumir(lexer_1.TokenType.AbreColch);
        const elementos = [];
        while (!this.match(lexer_1.TokenType.FechaColch) && !this.match(lexer_1.TokenType.EOF)) {
            elementos.push(this.parseExpressao());
            if (this.match(lexer_1.TokenType.Virgula))
                this.posicao++;
        }
        this.consumir(lexer_1.TokenType.FechaColch);
        return { tipo: "ListaLiteral", elementos, linha };
    }
}
exports.Parser = Parser;
