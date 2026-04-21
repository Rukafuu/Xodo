import { Token, TokenType, Lexer } from "./lexer";
import * as AST from "./ast";

export class Parser {
    private tokens: Token[];
    private posicao: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private atual(): Token {
        return this.tokens[this.posicao];
    }

    private peek(offset: number = 1): Token {
        return this.tokens[this.posicao + offset];
    }

    private consumir(tipo: TokenType): Token {
        const token = this.atual();
        if (token.tipo !== tipo) {
            throw new Error(
                `[Parser] Esperava ${tipo} mas encontrou ${token.tipo} ("${token.valor}") na linha ${token.linha}`
            );
        }
        this.posicao++;
        return token;
    }

    private match(...tipos: TokenType[]): boolean {
        return tipos.includes(this.atual().tipo);
    }

    // ─── Ponto de entrada ─────────────────────────────────────────────────────

    public parsear(): AST.Programa {
        const corpo: AST.Nodo[] = [];
        while (!this.match(TokenType.EOF)) {
            corpo.push(this.parseDeclaracao());
        }
        return { tipo: "Programa", corpo };
    }

    // ─── Declarações ──────────────────────────────────────────────────────────

    private parseDeclaracao(): AST.Nodo {
        const t = this.atual();

        if (t.tipo === TokenType.Call)     return this.parseDeclaracaoCall();
        if (t.tipo === TokenType.Se)       return this.parseInstrucaoSe();
        if (t.tipo === TokenType.Tente)    return this.parseInstrucaoTente();
        if (t.tipo === TokenType.Enquanto) return this.parseInstrucaoEnquanto();
        if (t.tipo === TokenType.ParaCada) return this.parseInstrucaoParaCada();
        if (t.tipo === TokenType.Retornar) return this.parseInstrucaoRetornar();
        if (t.tipo === TokenType.Usar)     return this.parseInstrucaoUsar();
        if (t.tipo === TokenType.ComContexto) return this.parseInstrucaoComContexto();
        if (t.tipo === TokenType.Parar)    return this.parseInstrucaoParar();
        if (t.tipo === TokenType.Proximo)  return this.parseInstrucaoProximo();

        // Identificador seguido de = ou := → declaração de variável
        if (
            t.tipo === TokenType.Identificador &&
            (this.peek().tipo === TokenType.Atribuicao ||
             this.peek().tipo === TokenType.AtribuicaoFixa)
        ) {
            return this.parseDeclaracaoVariavel();
        }

        // Tudo mais é expressão usada como instrução (Evoke, invocação, etc.)
        const linha = t.linha;
        const expressao = this.parseExpressao();
        return { tipo: "InstrucaoExpressao", expressao, linha };
    }

    private parseDeclaracaoVariavel(): AST.DeclaracaoVariavel {
        const nomeToken = this.consumir(TokenType.Identificador);
        const constante = this.atual().tipo === TokenType.AtribuicaoFixa;
        this.posicao++; // consome = ou :=
        const valor = this.parseExpressao();
        return { tipo: "DeclaracaoVariavel", nome: nomeToken.valor, valor, constante, linha: nomeToken.linha };
    }

    private parseDeclaracaoCall(): AST.DeclaracaoCall {
        const linha = this.atual().linha;
        this.consumir(TokenType.Call);
        const nome = this.consumir(TokenType.Identificador).valor;
        this.consumir(TokenType.AbrePar);

        const params: string[] = [];
        while (!this.match(TokenType.FechaPar)) {
            params.push(this.consumir(TokenType.Identificador).valor);
            if (this.match(TokenType.Virgula)) this.posicao++;
        }
        this.consumir(TokenType.FechaPar);

        const corpo = this.parseBloco();
        return { tipo: "DeclaracaoCall", nome, params, corpo, linha };
    }

    private parseInstrucaoSe(): AST.InstrucaoSe {
        const linha = this.atual().linha;
        this.consumir(TokenType.Se);
        this.consumir(TokenType.AbrePar);
        const condicao = this.parseExpressao();
        this.consumir(TokenType.FechaPar);
        const entao = this.parseBloco();

        let senao: AST.Nodo[] | undefined;
        if (this.match(TokenType.Senao)) {
            this.posicao++;
            // senao se ...
            if (this.match(TokenType.Se)) {
                senao = [this.parseInstrucaoSe()];
            } else {
                senao = this.parseBloco();
            }
        }

        return { tipo: "InstrucaoSe", condicao, entao, senao, linha };
    }

    private parseInstrucaoTente(): AST.InstrucaoTente {
        const linha = this.atual().linha;
        this.consumir(TokenType.Tente);
        const corpo = this.parseBloco();

        this.consumir(TokenType.Pegue);
        this.consumir(TokenType.AbrePar);
        const nomeErro = this.consumir(TokenType.Identificador).valor;
        this.consumir(TokenType.FechaPar);
        const pegue = this.parseBloco();

        return { tipo: "InstrucaoTente", corpo, nomeErro, pegue, linha };
    }

    private parseInstrucaoEnquanto(): AST.InstrucaoEnquanto {
        const linha = this.atual().linha;
        this.consumir(TokenType.Enquanto);
        this.consumir(TokenType.AbrePar);
        const condicao = this.parseExpressao();
        this.consumir(TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "InstrucaoEnquanto", condicao, corpo, linha };
    }

    private parseInstrucaoParaCada(): AST.InstrucaoParaCada {
        const linha = this.atual().linha;
        this.consumir(TokenType.ParaCada);
        this.consumir(TokenType.AbrePar);
        const variavel = this.consumir(TokenType.Identificador).valor;
        this.consumir(TokenType.Em);
        const iteravel = this.parseExpressao();
        this.consumir(TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "InstrucaoParaCada", variavel, iteravel, corpo, linha };
    }

    private parseInstrucaoRetornar(): AST.InstrucaoRetornar {
        const linha = this.atual().linha;
        this.consumir(TokenType.Retornar);
        // Se a próxima token inicia uma expressão, parseia o valor de retorno
        const semValor = this.match(TokenType.FechaChave, TokenType.EOF);
        const valor = semValor ? undefined : this.parseExpressao();
        return { tipo: "InstrucaoRetornar", valor, linha };
    }

    private parseInstrucaoUsar(): AST.InstrucaoUsar {
        const linha = this.atual().linha;
        this.consumir(TokenType.Usar);
        const caminho = this.consumir(TokenType.String).valor;
        return { tipo: "InstrucaoUsar", caminho, linha };
    }

    private parseInstrucaoParar(): AST.InstrucaoParar {
        const linha = this.atual().linha;
        this.consumir(TokenType.Parar);
        return { tipo: "InstrucaoParar", linha };
    }

    private parseInstrucaoProximo(): AST.InstrucaoProximo {
        const linha = this.atual().linha;
        this.consumir(TokenType.Proximo);
        return { tipo: "InstrucaoProximo", linha };
    }

    private parseInstrucaoComContexto(): AST.InstrucaoComContexto {
        const linha = this.atual().linha;
        this.consumir(TokenType.ComContexto);
        this.consumir(TokenType.AbrePar);
        const contexto = this.parseExpressao();
        this.consumir(TokenType.FechaPar);
        const corpo = this.parseBloco();
        return { tipo: "InstrucaoComContexto", contexto, corpo, linha };
    }

    private parseBloco(): AST.Nodo[] {
        this.consumir(TokenType.AbreChave);
        const corpo: AST.Nodo[] = [];
        while (!this.match(TokenType.FechaChave) && !this.match(TokenType.EOF)) {
            corpo.push(this.parseDeclaracao());
        }
        this.consumir(TokenType.FechaChave);
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

    private parseExpressao(): AST.Nodo {
        return this.parseOu();
    }

    private parseOu(): AST.Nodo {
        let esquerda = this.parseE();
        while (this.match(TokenType.Ou)) {
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseE();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: "ou", direita, linha };
        }
        return esquerda;
    }

    private parseE(): AST.Nodo {
        let esquerda = this.parseComparacao();
        while (this.match(TokenType.E)) {
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseComparacao();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: "e", direita, linha };
        }
        return esquerda;
    }

    private parseComparacao(): AST.Nodo {
        let esquerda = this.parseAditiva();
        while (this.match(
            TokenType.Igualdade, TokenType.Diferente,
            TokenType.MaiorQue, TokenType.MenorQue,
            TokenType.MaiorIgual, TokenType.MenorIgual
        )) {
            const op = this.atual().valor as "==" | "!=" | ">" | "<" | ">=" | "<=";
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseAditiva();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: op, direita, linha };
        }
        return esquerda;
    }

    private parseAditiva(): AST.Nodo {
        let esquerda = this.parseMultipl();
        while (this.match(TokenType.Soma, TokenType.Subtracao)) {
            const op = this.atual().valor as "+" | "-";
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseMultipl();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: op, direita, linha };
        }
        return esquerda;
    }

    private parseMultipl(): AST.Nodo {
        let esquerda = this.parseUnaria();
        while (this.match(TokenType.Multiplicacao, TokenType.Divisao, TokenType.Modulo)) {
            const op = this.atual().valor as "*" | "/" | "%";
            const linha = this.atual().linha;
            this.posicao++;
            const direita = this.parseUnaria();
            esquerda = { tipo: "ExpressaoBinaria", esquerda, operador: op, direita, linha };
        }
        return esquerda;
    }

    private parseUnaria(): AST.Nodo {
        if (this.match(TokenType.Nao)) {
            const linha = this.atual().linha;
            this.posicao++;
            const operando = this.parseUnaria();
            return { tipo: "ExpressaoUnaria", operador: "nao", operando, linha };
        }
        // Número negativo: -5 (mas só se seguido de número, não de expressão)
        if (this.match(TokenType.Subtracao) && this.peek().tipo === TokenType.Numero) {
            const linha = this.atual().linha;
            this.posicao++;
            const operando = this.parsePostfix();
            return { tipo: "ExpressaoUnaria", operador: "-", operando, linha };
        }
        return this.parsePostfix();
    }

    private parsePostfix(): AST.Nodo {
        let nodo = this.parsePrimario();

        while (this.match(TokenType.Ponto) || this.match(TokenType.AbreColch)) {
            const linha = this.atual().linha;

            if (this.match(TokenType.Ponto)) {
                this.posicao++; // consome .
                const campo = this.consumir(TokenType.Identificador).valor;
                nodo = { tipo: "AcessoMembro", objeto: nodo, campo, linha };
            } else {
                this.posicao++; // consome [
                const indice = this.parseExpressao();
                this.consumir(TokenType.FechaColch);
                nodo = { tipo: "AcessoIndice", objeto: nodo, indice, linha };
            }
        }

        return nodo;
    }

    private parsePrimario(): AST.Nodo {
        const t = this.atual();

        if (t.tipo === TokenType.Ask)       return this.parseAsk();
        if (t.tipo === TokenType.Evoke)     return this.parseEvoke();
        if (t.tipo === TokenType.AbreChave) return this.parseObjetoLiteral();
        if (t.tipo === TokenType.AbreColch) return this.parseListaLiteral();

        if (t.tipo === TokenType.String) {
            this.posicao++;
            // Verifica se tem interpolação: {variavel} ou {expressao}
            if (t.valor.includes('{')) {
                return this.parseInterpolacao(t.valor, t.linha);
            }
            return { tipo: "LiteralString", valor: t.valor, linha: t.linha };
        }
        if (t.tipo === TokenType.Numero) {
            this.posicao++;
            return { tipo: "LiteralNumero", valor: parseFloat(t.valor), linha: t.linha };
        }
        if (t.tipo === TokenType.Verdadeiro) {
            this.posicao++;
            return { tipo: "LiteralBooleano", valor: true, linha: t.linha };
        }
        if (t.tipo === TokenType.Falso) {
            this.posicao++;
            return { tipo: "LiteralBooleano", valor: false, linha: t.linha };
        }
        if (t.tipo === TokenType.Nulo) {
            this.posicao++;
            return { tipo: "LiteralNulo", linha: t.linha };
        }

        // texto / numero / booleano como valor dentro de um schema (def)
        if (
            t.tipo === TokenType.TipoTexto ||
            t.tipo === TokenType.TipoNumero ||
            t.tipo === TokenType.TipoBooleano
        ) {
            this.posicao++;
            return { tipo: "TipoXodo", nome: t.valor as "texto" | "numero" | "booleano", linha: t.linha };
        }

        // Identificador: invocação ou referência
        if (t.tipo === TokenType.Identificador) {
            this.posicao++;
            if (this.match(TokenType.AbrePar)) {
                this.consumir(TokenType.AbrePar);
                const args: AST.Nodo[] = [];
                while (!this.match(TokenType.FechaPar) && !this.match(TokenType.EOF)) {
                    args.push(this.parseExpressao());
                    if (this.match(TokenType.Virgula)) this.posicao++;
                }
                this.consumir(TokenType.FechaPar);
                return { tipo: "ExpressaoInvocacao", nome: t.valor, args, linha: t.linha };
            }
            return { tipo: "Identificador", nome: t.valor, linha: t.linha };
        }

        // Expressão agrupada por parênteses
        if (t.tipo === TokenType.AbrePar) {
            this.posicao++;
            const expr = this.parseExpressao();
            this.consumir(TokenType.FechaPar);
            return expr;
        }

        throw new Error(`[Parser] Token inesperado: ${t.tipo} ("${t.valor}") na linha ${t.linha}`);
    }

    // ─── Interpolação de string ────────────────────────────────────────────────

    /**
     * Converte "Olá {nome}, você tem {idade} anos" em um nó ExpressaoInterpolada.
     * Partes: ["Olá ", Identificador(nome), ", você tem ", Identificador(idade), " anos"]
     */
    private parseInterpolacao(raw: string, linha: number): AST.Nodo {
        const partes: (string | AST.Nodo)[] = [];
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
                    if (raw[i] === '{') depth++;
                    else if (raw[i] === '}') {
                        depth--;
                        if (depth === 0) { i++; break; }
                    }
                    expr += raw[i];
                    i++;
                }
                // Mini-parseia a expressão dentro das chaves
                const subLexer = new Lexer(expr.trim());
                const subTokens = subLexer.tokenizar();
                const subParser = new Parser(subTokens);
                const nodo = subParser.parseExpressao();
                partes.push(nodo);
            } else {
                atual += raw[i];
                i++;
            }
        }
        if (atual.length > 0) partes.push(atual);

        // Otimização: se só tem texto puro (sem expressões), retorna LiteralString
        if (partes.every(p => typeof p === "string")) {
            return { tipo: "LiteralString", valor: partes.join(""), linha };
        }

        return { tipo: "ExpressaoInterpolada", partes, linha };
    }

    // ─── Helpers de expressões nativas ───────────────────────────────────────

    private parseAsk(): AST.ExpressaoAsk {
        const linha = this.atual().linha;
        this.consumir(TokenType.Ask);
        this.consumir(TokenType.AbrePar);

        const entrada   = this.parseExpressao(); this.consumir(TokenType.Virgula);
        const modelo    = this.parseExpressao(); this.consumir(TokenType.Virgula);
        const sysPrompt = this.parseExpressao();

        let schema: AST.Nodo | undefined;
        if (this.match(TokenType.Virgula)) {
            this.posicao++;
            schema = this.parseExpressao();
        }

        this.consumir(TokenType.FechaPar);
        return { tipo: "ExpressaoAsk", entrada, modelo, sysPrompt, schema, linha };
    }

    private parseEvoke(): AST.ExpressaoEvoke {
        const linha = this.atual().linha;
        this.consumir(TokenType.Evoke);
        this.consumir(TokenType.AbrePar);
        const valor = this.parseExpressao();
        this.consumir(TokenType.FechaPar);
        return { tipo: "ExpressaoEvoke", valor, linha };
    }

    private parseObjetoLiteral(): AST.ObjetoLiteral {
        const linha = this.atual().linha;
        this.consumir(TokenType.AbreChave);
        const campos: AST.CampoObjeto[] = [];

        while (!this.match(TokenType.FechaChave) && !this.match(TokenType.EOF)) {
            const chaveToken = this.consumir(TokenType.Identificador);
            this.consumir(TokenType.DoisPontos);
            const valor = this.parseExpressao();
            campos.push({ tipo: "CampoObjeto", chave: chaveToken.valor, valor, linha: chaveToken.linha });
            if (this.match(TokenType.Virgula)) this.posicao++;
        }

        this.consumir(TokenType.FechaChave);
        return { tipo: "ObjetoLiteral", campos, linha };
    }

    private parseListaLiteral(): AST.ListaLiteral {
        const linha = this.atual().linha;
        this.consumir(TokenType.AbreColch);
        const elementos: AST.Nodo[] = [];

        while (!this.match(TokenType.FechaColch) && !this.match(TokenType.EOF)) {
            elementos.push(this.parseExpressao());
            if (this.match(TokenType.Virgula)) this.posicao++;
        }

        this.consumir(TokenType.FechaColch);
        return { tipo: "ListaLiteral", elementos, linha };
    }
}
