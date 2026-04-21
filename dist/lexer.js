"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Palavras-chave de controle
    TokenType["Call"] = "Call";
    TokenType["Se"] = "Se";
    TokenType["Senao"] = "Senao";
    TokenType["Tente"] = "Tente";
    TokenType["Pegue"] = "Pegue";
    TokenType["Enquanto"] = "Enquanto";
    TokenType["ParaCada"] = "ParaCada";
    TokenType["Retornar"] = "Retornar";
    TokenType["Em"] = "Em";
    TokenType["Parar"] = "Parar";
    TokenType["Proximo"] = "Proximo";
    // Funções nativas
    TokenType["Ask"] = "Ask";
    TokenType["Evoke"] = "Evoke";
    TokenType["Usar"] = "Usar";
    TokenType["ComContexto"] = "ComContexto";
    // Tipos de schema (mapeados para JSON Schema no runtime)
    TokenType["TipoTexto"] = "TipoTexto";
    TokenType["TipoNumero"] = "TipoNumero";
    TokenType["TipoBooleano"] = "TipoBooleano";
    // Identificadores e literais
    TokenType["Identificador"] = "Identificador";
    TokenType["Numero"] = "Numero";
    TokenType["String"] = "String";
    TokenType["Verdadeiro"] = "Verdadeiro";
    TokenType["Falso"] = "Falso";
    TokenType["Nulo"] = "Nulo";
    // Operadores de atribuição
    TokenType["Atribuicao"] = "Atribuicao";
    TokenType["AtribuicaoFixa"] = "AtribuicaoFixa";
    // Operadores de comparação
    TokenType["Igualdade"] = "Igualdade";
    TokenType["Diferente"] = "Diferente";
    TokenType["MaiorQue"] = "MaiorQue";
    TokenType["MenorQue"] = "MenorQue";
    TokenType["MaiorIgual"] = "MaiorIgual";
    TokenType["MenorIgual"] = "MenorIgual";
    // Operadores aritméticos
    TokenType["Soma"] = "Soma";
    TokenType["Subtracao"] = "Subtracao";
    TokenType["Multiplicacao"] = "Multiplicacao";
    TokenType["Divisao"] = "Divisao";
    TokenType["Modulo"] = "Modulo";
    // Operadores lógicos
    TokenType["E"] = "E";
    TokenType["Ou"] = "Ou";
    TokenType["Nao"] = "Nao";
    // Pontuação
    TokenType["AbreChave"] = "AbreChave";
    TokenType["FechaChave"] = "FechaChave";
    TokenType["AbrePar"] = "AbrePar";
    TokenType["FechaPar"] = "FechaPar";
    TokenType["AbreColch"] = "AbreColch";
    TokenType["FechaColch"] = "FechaColch";
    TokenType["Virgula"] = "Virgula";
    TokenType["DoisPontos"] = "DoisPontos";
    TokenType["Ponto"] = "Ponto";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
const KEYWORDS = {
    "call": TokenType.Call,
    "se": TokenType.Se,
    "senao": TokenType.Senao,
    "tente": TokenType.Tente,
    "pegue": TokenType.Pegue,
    "enquanto": TokenType.Enquanto,
    "para_cada": TokenType.ParaCada,
    "retornar": TokenType.Retornar,
    "em": TokenType.Em,
    "ask": TokenType.Ask,
    "Evoke": TokenType.Evoke,
    "usar": TokenType.Usar,
    "texto": TokenType.TipoTexto,
    "numero": TokenType.TipoNumero,
    "booleano": TokenType.TipoBooleano,
    "verdadeiro": TokenType.Verdadeiro,
    "falso": TokenType.Falso,
    "nulo": TokenType.Nulo,
    "e": TokenType.E,
    "ou": TokenType.Ou,
    "nao": TokenType.Nao,
    "parar": TokenType.Parar,
    "proximo": TokenType.Proximo,
    "com_contexto": TokenType.ComContexto,
};
class Lexer {
    codigo;
    posicao = 0;
    linha = 1;
    constructor(codigo) {
        this.codigo = codigo;
    }
    tokenizar() {
        const tokens = [];
        while (this.posicao < this.codigo.length) {
            const char = this.codigo[this.posicao];
            // Whitespace
            if (char === ' ' || char === '\r' || char === '\t') {
                this.posicao++;
                continue;
            }
            if (char === '\n') {
                this.linha++;
                this.posicao++;
                continue;
            }
            // Comentários de bloco (/* */)
            if (char === '/' && this.codigo[this.posicao + 1] === '*') {
                this.posicao += 2;
                while (this.posicao < this.codigo.length) {
                    if (this.codigo[this.posicao] === '*' && this.codigo[this.posicao + 1] === '/') {
                        this.posicao += 2;
                        break;
                    }
                    if (this.codigo[this.posicao] === '\n')
                        this.linha++;
                    this.posicao++;
                }
                continue;
            }
            // Comentários de linha (//)
            if (char === '/' && this.codigo[this.posicao + 1] === '/') {
                while (this.posicao < this.codigo.length && this.codigo[this.posicao] !== '\n') {
                    this.posicao++;
                }
                continue;
            }
            // := e :
            if (char === ':') {
                if (this.codigo[this.posicao + 1] === '=') {
                    tokens.push({ tipo: TokenType.AtribuicaoFixa, valor: ":=", linha: this.linha });
                    this.posicao += 2;
                }
                else {
                    tokens.push({ tipo: TokenType.DoisPontos, valor: ":", linha: this.linha });
                    this.posicao++;
                }
                continue;
            }
            // ==, =
            if (char === '=') {
                if (this.codigo[this.posicao + 1] === '=') {
                    tokens.push({ tipo: TokenType.Igualdade, valor: "==", linha: this.linha });
                    this.posicao += 2;
                }
                else {
                    tokens.push({ tipo: TokenType.Atribuicao, valor: "=", linha: this.linha });
                    this.posicao++;
                }
                continue;
            }
            // !=
            if (char === '!' && this.codigo[this.posicao + 1] === '=') {
                tokens.push({ tipo: TokenType.Diferente, valor: "!=", linha: this.linha });
                this.posicao += 2;
                continue;
            }
            // >=, >
            if (char === '>') {
                if (this.codigo[this.posicao + 1] === '=') {
                    tokens.push({ tipo: TokenType.MaiorIgual, valor: ">=", linha: this.linha });
                    this.posicao += 2;
                }
                else {
                    tokens.push({ tipo: TokenType.MaiorQue, valor: ">", linha: this.linha });
                    this.posicao++;
                }
                continue;
            }
            // <=, <
            if (char === '<') {
                if (this.codigo[this.posicao + 1] === '=') {
                    tokens.push({ tipo: TokenType.MenorIgual, valor: "<=", linha: this.linha });
                    this.posicao += 2;
                }
                else {
                    tokens.push({ tipo: TokenType.MenorQue, valor: "<", linha: this.linha });
                    this.posicao++;
                }
                continue;
            }
            // Operadores aritméticos
            if (char === '+') {
                tokens.push({ tipo: TokenType.Soma, valor: "+", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '-') {
                tokens.push({ tipo: TokenType.Subtracao, valor: "-", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '*') {
                tokens.push({ tipo: TokenType.Multiplicacao, valor: "*", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '/') {
                tokens.push({ tipo: TokenType.Divisao, valor: "/", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '%') {
                tokens.push({ tipo: TokenType.Modulo, valor: "%", linha: this.linha });
                this.posicao++;
                continue;
            }
            // Pontuação
            if (char === '{') {
                tokens.push({ tipo: TokenType.AbreChave, valor: "{", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '}') {
                tokens.push({ tipo: TokenType.FechaChave, valor: "}", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '(') {
                tokens.push({ tipo: TokenType.AbrePar, valor: "(", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === ')') {
                tokens.push({ tipo: TokenType.FechaPar, valor: ")", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '[') {
                tokens.push({ tipo: TokenType.AbreColch, valor: "[", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === ']') {
                tokens.push({ tipo: TokenType.FechaColch, valor: "]", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === ',') {
                tokens.push({ tipo: TokenType.Virgula, valor: ",", linha: this.linha });
                this.posicao++;
                continue;
            }
            if (char === '.') {
                tokens.push({ tipo: TokenType.Ponto, valor: ".", linha: this.linha });
                this.posicao++;
                continue;
            }
            // String com interpolação (suporte a {variavel} dentro de "...")
            if (char === '"') {
                let str = "";
                this.posicao++; // pula "
                while (this.posicao < this.codigo.length && this.codigo[this.posicao] !== '"') {
                    if (this.codigo[this.posicao] === '\\' && this.codigo[this.posicao + 1] === '"') {
                        str += '"';
                        this.posicao += 2;
                    }
                    else if (this.codigo[this.posicao] === '\\' && this.codigo[this.posicao + 1] === 'n') {
                        str += '\n';
                        this.posicao += 2;
                    }
                    else {
                        str += this.codigo[this.posicao];
                        this.posicao++;
                    }
                }
                if (this.posicao >= this.codigo.length) {
                    throw new Error(`[Lexer] String não fechada na linha ${this.linha}`);
                }
                this.posicao++; // pula "
                tokens.push({ tipo: TokenType.String, valor: str, linha: this.linha });
                continue;
            }
            // Número literal (inteiro ou decimal)
            if (/[0-9]/.test(char)) {
                let num = "";
                let temPonto = false;
                while (this.posicao < this.codigo.length && /[0-9.]/.test(this.codigo[this.posicao])) {
                    if (this.codigo[this.posicao] === '.') {
                        if (temPonto)
                            break;
                        temPonto = true;
                    }
                    num += this.codigo[this.posicao];
                    this.posicao++;
                }
                tokens.push({ tipo: TokenType.Numero, valor: num, linha: this.linha });
                continue;
            }
            // Identificador ou palavra-chave (suporte a underscore + números para para_cada etc)
            if (/[a-zA-Z_]/.test(char)) {
                let ident = "";
                while (this.posicao < this.codigo.length && /[a-zA-Z0-9_]/.test(this.codigo[this.posicao])) {
                    ident += this.codigo[this.posicao];
                    this.posicao++;
                }
                const keyword = KEYWORDS[ident];
                tokens.push({ tipo: keyword ?? TokenType.Identificador, valor: ident, linha: this.linha });
                continue;
            }
            throw new Error(`[Lexer] Caractere inesperado '${char}' na linha ${this.linha}`);
        }
        tokens.push({ tipo: TokenType.EOF, valor: "EOF", linha: this.linha });
        return tokens;
    }
}
exports.Lexer = Lexer;
